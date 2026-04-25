from flask import Flask, request, jsonify
from flask_cors import CORS
from ortools.sat.python import cp_model

app = Flask(__name__)
CORS(app)


def solve_nonogram_ilp(row_clues, col_clues, known=None):
    """
    Giải nonogram bằng CP-SAT với interval variables.
    Không sinh pattern -- mô hình trực tiếp từng block bằng interval + booleans.
    """
    rows = len(row_clues)
    cols = len(col_clues)
    if known is None:
        known = [[-1] * cols for _ in range(rows)]

    model = cp_model.CpModel()

    # ── Cell variables ────────────────────────────────────────────────────────
    # cell[r][c] = 1 nếu ô được tô, 0 nếu trống.
    cell = []
    for r in range(rows):
        row_vars = []
        for c in range(cols):
            v = known[r][c]
            if v == -1:
                row_vars.append(model.new_bool_var(f'c_{r}_{c}'))
            else:
                # Ô đã biết: dùng hằng số (IntVar cố định)
                fixed = model.new_int_var(v, v, f'cf_{r}_{c}')
                row_vars.append(fixed)
        cell.append(row_vars)

    # ── Helper: thêm ràng buộc clues cho một dòng ────────────────────────────
    def add_line_constraints(length, clues, line_vars):
        """
        Với mỗi block k có độ dài clues[k]:
          - Tạo biến start_k ∈ [lo_k, hi_k] (giới hạn chặt từ min-spacing).
          - Đặt interval variable độ dài clues[k].
          - AddNoOverlap đảm bảo các block không chồng và có khoảng trống ≥ 1.
          - Liên kết interval với cell_vars bằng ràng buộc tuyến tính:
              ∀ pos ∈ [start_k, start_k + len_k): cell[pos] = 1
            Thực hiện bằng: cell[pos] >= presence(interval covers pos)
            Cụ thể dùng biến bool is_covered[pos] và AddLinearConstraint.

        Cách đơn giản và hiệu quả hơn: dùng AddAllowedAssignments chỉ cho
        các biến start (rất nhỏ so với liệt kê pattern), rồi dùng element.

        Thực tế đơn giản nhất với CP-SAT cho nonogram:
          - Với mỗi block k, tạo start_k.
          - Ràng buộc thứ tự: start_{k+1} >= start_k + len_k + 1.
          - Ràng buộc biên: start_0 >= 0, start_{K-1} + len_{K-1} <= length.
          - Ràng buộc cell = 1 khi được phủ bởi block nào đó:
              cell[pos] == 1  <=>  ∃ k: start_k <= pos < start_k + len_k
            Thực hiện bằng biến bool covered[pos][k] + LinearConstraint.
        """
        K = len(clues)
        if K == 0:
            # Tất cả ô phải là 0
            for v in line_vars:
                model.add(v == 0)
            return

        # Tính earliest/latest start cho từng block
        earliest = []
        pos = 0
        for k in range(K):
            earliest.append(pos)
            pos += clues[k] + 1

        latest = []
        pos = length
        for k in range(K - 1, -1, -1):
            pos -= clues[k]
            latest.append(pos)
            pos -= 1
        latest.reverse()

        # Biến start cho mỗi block
        starts = [
            model.new_int_var(earliest[k], latest[k], f'start_{id(line_vars)}_{k}')
            for k in range(K)
        ]

        # Ràng buộc thứ tự: start[k+1] >= start[k] + len[k] + 1
        for k in range(K - 1):
            model.add(starts[k + 1] >= starts[k] + clues[k] + 1)

        # Biên cuối: start[K-1] + len[K-1] <= length
        model.add(starts[K - 1] + clues[K - 1] <= length)

        # Liên kết block với cell:
        # covered[pos][k] = 1 nếu block k phủ vị trí pos
        # cell[pos] = OR(covered[pos][k] for k in range(K))
        for pos in range(length):
            covered_by = []
            for k in range(K):
                # block k phủ pos  <=>  start[k] <= pos  AND  pos < start[k] + clues[k]
                #                  <=>  start[k] <= pos  AND  start[k] >= pos - clues[k] + 1
                lo = max(earliest[k], pos - clues[k] + 1)
                hi = min(latest[k], pos)
                if lo > hi:
                    continue  # block k không thể phủ pos
                b = model.new_bool_var(f'cov_{id(line_vars)}_{pos}_{k}')
                # b = 1  =>  lo <= start[k] <= hi
                model.add(starts[k] >= lo).only_enforce_if(b)
                model.add(starts[k] <= hi).only_enforce_if(b)
                # b = 0  =>  start[k] < lo  OR  start[k] > hi
                # Biểu diễn bằng: start[k] < lo  OR  start[k] > hi khi b=0
                # Dùng biến phụ:
                before = model.new_bool_var(f'before_{id(line_vars)}_{pos}_{k}')
                after = model.new_bool_var(f'after_{id(line_vars)}_{pos}_{k}')
                model.add_bool_or([before, after, b])
                model.add(starts[k] <= lo - 1).only_enforce_if(before)
                model.add(starts[k] >= hi + 1).only_enforce_if(after)
                model.add_bool_or([before, after]).only_enforce_if(b.negated())
                covered_by.append(b)

            if not covered_by:
                model.add(line_vars[pos] == 0)
            else:
                # cell[pos] = 1  <=>  any covered_by is true
                model.add_bool_or(covered_by).only_enforce_if(line_vars[pos])
                model.add(line_vars[pos] == 0).only_enforce_if(
                    *[b.negated() for b in covered_by]
                )
                # Ngược: if cell=0 thì tất cả covered_by = 0
                for b in covered_by:
                    model.add(b == 0).only_enforce_if(line_vars[pos].negated())

    # ── Thêm ràng buộc cho tất cả hàng và cột ────────────────────────────────
    for r in range(rows):
        add_line_constraints(cols, row_clues[r], cell[r])

    for c in range(cols):
        col_vars = [cell[r][c] for r in range(rows)]
        add_line_constraints(rows, col_clues[c], col_vars)

    # ── Giải ─────────────────────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 120
    solver.parameters.num_search_workers = 8
    solver.parameters.log_search_progress = False

    status = solver.solve(model)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        result = []
        for r in range(rows):
            row = []
            for c in range(cols):
                v = cell[r][c]
                try:
                    row.append(solver.value(v))
                except Exception:
                    row.append(int(v))  # fixed IntVar / known cell
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

        n_rows = len(row_clues)
        n_cols = len(col_clues)

        if n_rows < 2 or n_rows > 50 or n_cols < 2 or n_cols > 50:
            return jsonify({'status': 'error', 'message': 'Invalid size (must be 2–50)'}), 400

        if sum(sum(rc) for rc in row_clues) != sum(sum(cc) for cc in col_clues):
            return jsonify({'status': 'error', 'message': 'Clue sums mismatch'}), 400

        if known is not None:
            if len(known) != n_rows or any(len(r) != n_cols for r in known):
                return jsonify({'status': 'error', 'message': 'Known grid dimension mismatch'}), 400

        solution = solve_nonogram_ilp(row_clues, col_clues, known)
        if solution is not None:
            return jsonify({'status': 'solved', 'grid': solution})
        else:
            return jsonify({'status': 'impossible'})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'message': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=False, port=5000)
