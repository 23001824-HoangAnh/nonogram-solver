from flask import Flask, request, jsonify
from flask_cors import CORS
from ortools.sat.python import cp_model

app = Flask(__name__)
CORS(app)

def generate_patterns(length, clues, known_line):
    """Sinh tất cả pattern hợp lệ cho một dòng/cột dựa trên known (-1/0/1)"""
    patterns = []
    def backtrack(idx, block_idx, current, in_block, block_len):
        if idx == length:
            if block_idx == len(clues):
                patterns.append(current[:])
            elif block_idx == len(clues) - 1 and block_len == clues[-1]:
                patterns.append(current[:])
            return
        cell = known_line[idx]
        # Ô đã biết
        if cell != -1:
            if cell == 1:
                if block_idx >= len(clues) or (in_block and block_len >= clues[block_idx]):
                    return
                current.append(1)
                backtrack(idx+1, block_idx, current, True, block_len+1)
                current.pop()
            else:  # cell == 0
                if in_block:
                    if block_len != clues[block_idx]:
                        return
                    current.append(0)
                    backtrack(idx+1, block_idx+1, current, False, 0)
                    current.pop()
                else:
                    current.append(0)
                    backtrack(idx+1, block_idx, current, False, 0)
                    current.pop()
            return
        # Ô chưa biết: thử 0
        if in_block:
            if block_len == clues[block_idx]:
                current.append(0)
                backtrack(idx+1, block_idx+1, current, False, 0)
                current.pop()
        else:
            current.append(0)
            backtrack(idx+1, block_idx, current, False, 0)
            current.pop()
        # thử 1
        if block_idx < len(clues) and (not in_block or block_len < clues[block_idx]):
            current.append(1)
            backtrack(idx+1, block_idx, current, True, block_len+1)
            current.pop()
    backtrack(0, 0, [], False, 0)
    return patterns

def solve_nonogram_ilp(row_clues, col_clues, known=None):
    rows = len(row_clues)
    cols = len(col_clues)
    if known is None:
        known = [[-1]*cols for _ in range(rows)]

    model = cp_model.CpModel()
    cell_vars = {}
    for r in range(rows):
        for c in range(cols):
            if known[r][c] == -1:
                cell_vars[(r, c)] = model.NewBoolVar(f'cell_{r}_{c}')
            else:
                cell_vars[(r, c)] = known[r][c]  # hằng số

    # Ràng buộc hàng
    for r in range(rows):
        row_vars = [cell_vars[(r, c)] for c in range(cols)]
        known_row = [known[r][c] for c in range(cols)]
        patterns = generate_patterns(cols, row_clues[r], known_row)
        if not patterns:
            return None
        model.AddAllowedAssignments(row_vars, patterns)

    # Ràng buộc cột
    for c in range(cols):
        col_vars = [cell_vars[(r, c)] for r in range(rows)]
        known_col = [known[r][c] for r in range(rows)]
        patterns = generate_patterns(rows, col_clues[c], known_col)
        if not patterns:
            return None
        model.AddAllowedAssignments(col_vars, patterns)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 60
    solver.parameters.num_search_workers = 8
    solver.parameters.log_search_progress = False
    status = solver.Solve(model)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        result = []
        for r in range(rows):
            row = []
            for c in range(cols):
                val = cell_vars[(r, c)]
                if isinstance(val, int):
                    row.append(val)
                else:
                    row.append(solver.Value(val))
            result.append(row)
        return result
    return None

@app.route('/solve', methods=['POST'])
def solve():
    try:
        data = request.get_json()
        row_clues = data['rowClues']
        col_clues = data['colClues']
        known = data.get('known', None)

        n = len(row_clues)
        if n < 2 or n > 50 or len(col_clues) != n:
            return jsonify({'status': 'error', 'message': 'Invalid size'}), 400

        if sum(sum(rc) for rc in row_clues) != sum(sum(cc) for cc in col_clues):
            return jsonify({'status': 'error', 'message': 'Clue sums mismatch'}), 400

        if known is not None:
            if len(known) != n or any(len(r) != n for r in known):
                return jsonify({'status': 'error', 'message': 'Known grid dimension mismatch'}), 400

        solution = solve_nonogram_ilp(row_clues, col_clues, known)
        if solution is not None:
            return jsonify({'status': 'solved', 'grid': solution})
        else:
            return jsonify({'status': 'impossible'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=False, port=5000)