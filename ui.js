/**
 * UI Handler - Xử lý giao diện người dùng (phiên bản tối ưu cho Nonogram 30-50)
 */

class UIHandler {
    constructor() {
        this.currentSize = 5;
        this.initializeElements();
        this.attachEventListeners();
    }

    /**
     * Khởi tạo các elements
     */
    initializeElements() {
        this.gridSizeInput = document.getElementById('gridSize');
        this.createBoardBtn = document.getElementById('createBoardBtn');
        this.clearAllBtn = document.getElementById('clearAllBtn');
        this.loadExampleBtn = document.getElementById('loadExampleBtn');
        this.load25ExampleBtn = document.getElementById('load25ExampleBtn');
        this.solveBtn = document.getElementById('solveBtn');
        this.solveBtnText = document.getElementById('solveBtnText');
        this.rowCluesContainer = document.getElementById('rowCluesContainer');
        this.colCluesContainer = document.getElementById('colCluesContainer');
        this.statusMessage = document.getElementById('statusMessage');
        this.solutionDisplay = document.getElementById('solutionDisplay');
    }

    /**
     * Gắn event listeners
     */
    attachEventListeners() {
        this.createBoardBtn.addEventListener('click', () => this.updateSize());
        this.clearAllBtn.addEventListener('click', () => this.clearAll());
        this.loadExampleBtn.addEventListener('click', () => this.loadExample());
        this.solveBtn.addEventListener('click', () => this.solvePuzzle());
        if (this.load25ExampleBtn) {
            this.load25ExampleBtn.addEventListener('click', () => this.load25Example());
        }

        // Cho phép nhấn Enter để tạo bảng
        this.gridSizeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.updateSize();
            }
        });
    }

    /**
     * Cập nhật kích thước bảng
     */
    updateSize() {
        const size = parseInt(this.gridSizeInput.value);

        if (isNaN(size) || size < 2 || size > 50) {
            alert('Kích thước phải từ 2 đến 50');
            this.gridSizeInput.value = this.currentSize;
            return;
        }

        this.currentSize = size;
        this.createClueInputs(size);
        this.clearOutput();
    }

    /**
     * Tạo các ô nhập clues
     * @param {number} size - Kích thước bảng
     */
    createClueInputs(size) {
        this.rowCluesContainer.innerHTML = '';
        this.colCluesContainer.innerHTML = '';

        // Tạo input cho row clues
        for (let i = 0; i < size; i++) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'clue-row';
            rowDiv.innerHTML = `
                <label for="rowClue_${i}">Dòng ${i + 1}:</label>
                <input type="text" id="rowClue_${i}" placeholder="VD: 2,1" autocomplete="off">
            `;
            this.rowCluesContainer.appendChild(rowDiv);
        }

        // Tạo input cho column clues
        for (let i = 0; i < size; i++) {
            const colDiv = document.createElement('div');
            colDiv.className = 'clue-row';
            colDiv.innerHTML = `
                <label for="colClue_${i}">Cột ${i + 1}:</label>
                <input type="text" id="colClue_${i}" placeholder="VD: 3" autocomplete="off">
            `;
            this.colCluesContainer.appendChild(colDiv);
        }
    }

    /**
     * Lấy dữ liệu clues từ input
     * @returns {Object|null} - {rowClues, colClues} hoặc null nếu lỗi
     */
    getCluesFromInputs() {
        const size = this.currentSize;
        const rowClues = [];
        const colClues = [];

        for (let i = 0; i < size; i++) {
            const rowInput = document.getElementById(`rowClue_${i}`).value.trim();
            const colInput = document.getElementById(`colClue_${i}`).value.trim();

            // Parse row clue
            if (rowInput === '') {
                rowClues.push([]);
            } else {
                const numbers = rowInput.split(',').map(num => parseInt(num.trim()));
                if (numbers.some(isNaN) || numbers.some(n => n < 0)) {
                    this.showError(`Dòng ${i + 1}: Dữ liệu không hợp lệ`);
                    return null;
                }
                // Kiểm tra tổng clue không vượt quá kích thước
                const sum = numbers.reduce((a, b) => a + b, 0);
                const minLen = sum + numbers.length - 1;
                if (minLen > size) {
                    this.showError(`Dòng ${i + 1}: Clue không hợp lệ (tổng + khoảng trắng > kích thước)`);
                    return null;
                }
                rowClues.push(numbers);
            }

            // Parse col clue
            if (colInput === '') {
                colClues.push([]);
            } else {
                const numbers = colInput.split(',').map(num => parseInt(num.trim()));
                if (numbers.some(isNaN) || numbers.some(n => n < 0)) {
                    this.showError(`Cột ${i + 1}: Dữ liệu không hợp lệ`);
                    return null;
                }
                const sum = numbers.reduce((a, b) => a + b, 0);
                const minLen = sum + numbers.length - 1;
                if (minLen > size) {
                    this.showError(`Cột ${i + 1}: Clue không hợp lệ (tổng + khoảng trắng > kích thước)`);
                    return null;
                }
                colClues.push(numbers);
            }
        }

        return { rowClues, colClues };
    }

    /**
     * Giải puzzle - chiến lược 3 lớp:
     * 1. Chạy logic reduction để lấy known
     * 2. Gọi server ILP với known (nếu có)
     * 3. Fallback JS solver với heuristic
     */
    async solvePuzzle() {
        const cluesData = this.getCluesFromInputs();
        if (!cluesData) return;
        const { rowClues, colClues } = cluesData;
        const size = this.currentSize;

        if (!NonogramSolver.validateClues(rowClues, colClues)) {
            this.showError('Tổng số ô được tô không khớp!');
            return;
        }

        this.showLoading();

        // Bước 1: Chạy logic reduction để có known grid
        let known = null;
        let reductionInfo = null;
        try {
            const emptyKnown = Array.from({ length: size }, () => new Array(size).fill(-1));
            reductionInfo = NonogramSolver.reduceGridWithLogic(emptyKnown, rowClues, colClues);
            known = reductionInfo.known;
            
            // Nếu logic reduction đã giải được hoàn toàn
            if (reductionInfo.unknownCnt === 0) {
                const solution = known.map(row => row.map(c => c === -1 ? 0 : c));
                this.showSuccess('✅ Đã giải hoàn toàn bằng logic!');
                this.displaySolution(solution, rowClues, colClues);
                return;
            }
        } catch (e) {
            console.warn('Logic reduction gặp lỗi:', e);
            // Tiếp tục với known = null
        }

        // Bước 2: Thử gọi server ILP với known
        try {
            const payload = { rowClues, colClues };
            if (known) {
                payload.known = known;
            }
            
            const response = await fetch('http://127.0.0.1:5000/solve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Server lỗi (${response.status})`);
            }
            
            const result = await response.json();
            if (result.status === 'solved') {
                const remainingCells = reductionInfo ? reductionInfo.unknownCnt : '?';
                this.showSuccess(`✅ Đã tìm thấy lời giải (Server ILP - còn ${remainingCells} ô chưa biết)!`);
                this.displaySolution(result.grid, rowClues, colClues);
                return;
            } else if (result.status === 'impossible') {
                this.showError('❌ Puzzle không có lời giải.');
                return;
            } else {
                this.showError('❌ Server không thể giải puzzle này.');
                return;
            }
        } catch (e) {
            console.warn('Server ILP không khả dụng:', e.message);
            
            // Nếu server lỗi nhưng puzzle nhỏ, thử JS solver
            if (size <= 20) {
                console.log('Thử giải bằng JS solver...');
            } else {
                // Puzzle lớn - thông báo cần server
                this.showError('❌ Server không khả dụng. Puzzle lớn hơn 20x20 cần server ILP để giải.');
                return;
            }
        }

        // Bước 3: Fallback JS solver (chỉ cho puzzle ≤ 20)
        if (size <= 20) {
            // Sử dụng setTimeout để không block UI
            setTimeout(() => {
                try {
                    const start = performance.now();
                    const solution = NonogramSolver.solve(rowClues, colClues, {
                        forceBacktrack: true  // ép dùng backtracking cho puzzle nhỏ
                    });
                    const end = performance.now();
                    
                    if (solution && !solution.suggestServer) {
                        this.showSuccess(`✅ Đã tìm thấy lời giải (JS solver, ${(end-start).toFixed(0)}ms)`);
                        this.displaySolution(solution, rowClues, colClues);
                    } else if (solution && solution.suggestServer) {
                        this.showError('❌ Puzzle này cần server ILP để giải chính xác.');
                        // Log partial solution để debug
                        console.log('Partial solution:', solution.partial);
                    } else {
                        this.showError('❌ Không tìm thấy lời giải.');
                    }
                } catch (err) {
                    console.error('JS solver error:', err);
                    this.showError('❌ Lỗi khi giải bằng JS solver.');
                }
            }, 50);
        }
    }

    /**
     * Hiển thị lời giải - tự động chọn renderer phù hợp
     * @param {number[][]} grid - Grid lời giải
     * @param {number[][]} rowClues - Row clues
     * @param {number[][]} colClues - Column clues
     */
    displaySolution(grid, rowClues, colClues) {
        const size = grid.length;
        
        // Với grid lớn (>20), dùng Canvas để hiệu suất cao
        if (size > 20) {
            this.renderCanvasSolution(grid, rowClues, colClues);
        } else {
            // Với grid nhỏ, dùng HTML table cho đẹp và dễ style
            this.renderTableSolution(grid, rowClues, colClues);
        }
        
        // Scroll đến solution
        this.solutionDisplay.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * Render solution bằng Canvas (cho grid lớn)
     */
    renderCanvasSolution(grid, rowClues, colClues) {
        const cellSize = 20;
        const fontSize = Math.max(10, cellSize * 0.55);
        
        const maxRowClueLength = Math.max(...rowClues.map(r => r.length), 1);
        const maxColClueLength = Math.max(...colClues.map(c => c.length), 1);
        
        const marginLeft = maxRowClueLength * cellSize + 10;
        const marginTop = maxColClueLength * cellSize + 10;
        
        const gridWidth = grid[0].length * cellSize;
        const gridHeight = grid.length * cellSize;
        
        const canvas = document.createElement('canvas');
        canvas.width = marginLeft + gridWidth + 20;
        canvas.height = marginTop + gridHeight + 20;
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';
        canvas.style.border = '1px solid #ddd';
        canvas.style.borderRadius = '4px';
        
        const ctx = canvas.getContext('2d');
        
        // Clear background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Setup text style
        ctx.fillStyle = '#333333';
        ctx.font = `${fontSize}px Arial, sans-serif`;
        ctx.textBaseline = 'middle';
        
        // Vẽ column clues
        ctx.textAlign = 'center';
        for (let c = 0; c < colClues.length; c++) {
            const clues = colClues[c];
            for (let i = 0; i < clues.length; i++) {
                const x = marginLeft + c * cellSize + cellSize / 2;
                const y = marginTop - (clues.length - i) * cellSize + cellSize / 2;
                ctx.fillText(clues[i].toString(), x, y);
            }
        }
        
        // Vẽ row clues
        ctx.textAlign = 'right';
        for (let r = 0; r < rowClues.length; r++) {
            const clues = rowClues[r];
            for (let i = 0; i < clues.length; i++) {
                const x = marginLeft - (clues.length - i) * cellSize + cellSize / 2;
                const y = marginTop + r * cellSize + cellSize / 2;
                ctx.fillText(clues[i].toString(), x, y);
            }
        }
        
        // Vẽ grid cells
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[0].length; c++) {
                const x = marginLeft + c * cellSize;
                const y = marginTop + r * cellSize;
                
                // Fill cell
                ctx.fillStyle = grid[r][c] === 1 ? '#1a1a2e' : '#ffffff';
                ctx.fillRect(x, y, cellSize, cellSize);
                
                // Grid line
                ctx.strokeStyle = '#cccccc';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x, y, cellSize, cellSize);
            }
        }
        
        // Vẽ đường viền ngoài đậm
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;
        ctx.strokeRect(marginLeft, marginTop, gridWidth, gridHeight);
        
        this.solutionDisplay.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.style.overflowX = 'auto';
        wrapper.style.padding = '10px';
        wrapper.appendChild(canvas);
        this.solutionDisplay.appendChild(wrapper);
    }

    /**
     * Render solution bằng HTML table (cho grid nhỏ)
     */
    renderTableSolution(grid, rowClues, colClues) {
        const maxRowClueLength = Math.max(...rowClues.map(r => r.length), 1);
        const maxColClueLength = Math.max(...colClues.map(c => c.length), 1);

        let html = '<div class="solution-grid"><div class="grid-wrapper" style="overflow-x: auto;"><table class="grid-table">';

        // Hiển thị column clues
        for (let i = 0; i < maxColClueLength; i++) {
            html += '<tr>';
            
            // Corner cells
            for (let j = 0; j < maxRowClueLength; j++) {
                html += '<td class="corner-cell"></td>';
            }
            
            // Column clue cells
            for (let j = 0; j < colClues.length; j++) {
                const clueIdx = i - (maxColClueLength - colClues[j].length);
                if (clueIdx >= 0 && clueIdx < colClues[j].length) {
                    html += `<td class="col-clue-cell">${colClues[j][clueIdx]}</td>`;
                } else {
                    html += '<td class="col-clue-cell empty-clue"></td>';
                }
            }
            html += '</tr>';
        }

        // Hiển thị grid rows
        for (let i = 0; i < grid.length; i++) {
            html += '<tr>';
            
            // Row clue cells
            const rowClue = rowClues[i];
            for (let j = 0; j < maxRowClueLength; j++) {
                const clueIdx = j - (maxRowClueLength - rowClue.length);
                if (clueIdx >= 0 && clueIdx < rowClue.length) {
                    html += `<td class="row-clue-cell">${rowClue[clueIdx]}</td>`;
                } else {
                    html += '<td class="row-clue-cell empty-clue"></td>';
                }
            }
            
            // Grid cells
            for (let j = 0; j < grid[i].length; j++) {
                const cellClass = grid[i][j] === 1 ? 'filled' : 'empty';
                html += `<td class="grid-cell ${cellClass}"></td>`;
            }
            html += '</tr>';
        }

        html += '</table></div></div>';
        this.solutionDisplay.innerHTML = html;
    }

    /**
     * Hiển thị trạng thái loading
     */
    showLoading() {
        this.solveBtnText.innerHTML = '<span class="loading-spinner"></span>Đang giải...';
        this.solveBtn.disabled = true;
        this.statusMessage.innerHTML = '<div class="status-message status-loading">🔄 Đang xử lý... Vui lòng đợi</div>';
        this.solutionDisplay.innerHTML = '';
    }

    /**
     * Hiển thị thông báo thành công
     * @param {string} message
     */
    showSuccess(message) {
        this.solveBtnText.innerHTML = '🔍 Giải Puzzle';
        this.solveBtn.disabled = false;
        this.statusMessage.innerHTML = `<div class="status-message status-success">${message}</div>`;
    }

    /**
     * Hiển thị thông báo lỗi
     * @param {string} message
     */
    showError(message) {
        this.solveBtnText.innerHTML = '🔍 Giải Puzzle';
        this.solveBtn.disabled = false;
        this.statusMessage.innerHTML = `<div class="status-message status-error">${message}</div>`;
    }

    /**
     * Xóa tất cả input và output
     */
    clearAll() {
        document.querySelectorAll('#rowCluesContainer input, #colCluesContainer input').forEach(input => {
            input.value = '';
        });
        this.clearOutput();
        this.statusMessage.innerHTML = '';
    }

    /**
     * Xóa phần output
     */
    clearOutput() {
        this.statusMessage.innerHTML = '';
        this.solutionDisplay.innerHTML = '';
        // Reset nút nếu đang disabled
        if (this.solveBtn.disabled) {
            this.solveBtnText.innerHTML = '🔍 Giải Puzzle';
            this.solveBtn.disabled = false;
        }
    }

    /**
     * Load example mẫu 50x50
     */
    loadExample() {
        this.gridSizeInput.value = 50;
        this.currentSize = 50;
        this.createClueInputs(50);
        this.clearOutput();

        const rowClues = [
            [3,1,3,1,1,1,8,3,3],
            [4,6,1,20,2],
            [4,9,15,4,5],
            [11,8,5,5,5],
            [1,2,5,3,6,11,1,3],
            [1,2,4,3,1,6,1,1,6,3],
            [3,3,3,7,3,3,4,1,1],
            [3,4,1,18,4,1,1,1],
            [3,3,2,16,1,1,3],
            [3,2,1,3,6,6,1,1,1],
            [1,3,3,6,5,1],
            [3,1,1,3,3,3,1,1],
            [1,1,4,3,1,6,3,1,5],
            [3,7,6,3,1,5,1],
            [4,7,1,3,2,1,1,3,6],
            [4,1,5,2,3,1,1,3,3,1],
            [4,2,1,1,3,3,3],
            [3,2,3,1,1,1,4,3],
            [1,5,2,5,2,3],
            [3,3,3,8,6,3,9],
            [3,10,8,3,4,1,1],
            [6,5,4,4,1,1,5],
            [1,2,3,1,10,3],
            [1,3,3,12,1],
            [1,2,1,5,9,2],
            [3,2,1,3,3,8,4],
            [2,3,4,3,1,9,1,2],
            [2,1,2,8,6,1,1,1],
            [2,1,2,7,8,2],
            [4,2,9,3,4,1,1],
            [2,1,5,3,3,3,9,2],
            [2,2,3,3,7,3,4,2,1],
            [2,1,1,2,5,3,4,2],
            [3,2,2,1,3,1,4,6],
            [3,4,3,1,1,3,2,6,3],
            [2,6,5,4,13],
            [2,1,9,5,4,4,1],
            [2,1,1,1,7,1,3,7,1,3],
            [1,1,1,4,2,1,1,1,5,2,2],
            [1,5,8,4,1],
            [2,7,1,13,4,1],
            [1,2,9,14,3,3],
            [2,3,7,1,7,2,5],
            [4,14,3,2,5],
            [3,3,3,4,1,2,3],
            [1,4,5,1,2,1,5],
            [3,2,3,4,1,3],
            [1,1,3,3,5,2,4,1,1,1],
            [4,4,3,1,1,9,2],
            [3,9,1,12,3]
        ];

        const colClues = [
            [1,1,7,1,2,2,8,2,4],
            [3,4,3,2,9,3,3],
            [3,4,3,2,1,3,3],
            [2,3,1,2,2,2,1,2],
            [1,1,3,2],
            [2,1,5,3,7,3],
            [4,2,1,2,1,4,3,2],
            [5,3,3,2,4,2],
            [1,5,2,5,1,1,1],
            [2,5,2,1,1,3,1,3],
            [7,4,4,1,1,1,1,3,7,2],
            [7,5,1,2,8,3,10],
            [8,4,3,7,2,4,4],
            [5,3,2,2,11,3],
            [4,3,3,1,1,11,1,1],
            [3,10,12,3],
            [2,1,12,1,1,15],
            [6,6,3,2,1,1,7],
            [7,3,1,7,3,1],
            [6,5,3,5],
            [2,6,1,1,1,6,1,1,1],
            [1,2,2,1,1,1,5,3,1,2],
            [4,3,7,1,5,1,1,4],
            [3,4,1,1,2,4,3,5],
            [6,3,3,1,3,2,1,1,3],
            [9,2,1,2,1,6,1,1],
            [15,6,1,3,2],
            [14,3,1,5,3],
            [6,6,1,3,3,1,4,3],
            [6,4,3,3,4,5,5,2],
            [3,14,3,5,6,2],
            [14,3,3,1,1,9,4],
            [4,3,1,3,1,1,8,5],
            [10,3,4,5,3,5],
            [4,3,3,3,3,6,3,4],
            [4,7,5,6,4,1],
            [3,7,1,1,15,4,1],
            [2,8,1,3,9,2,4],
            [10,3,8,1,4,1],
            [5,3,15,1],
            [5,5,6,11,5],
            [4,2,15,10],
            [8,3,3,2,2],
            [1,1,3,2,3,4,1,1,1],
            [1,6,6,1,1,1,1],
            [18,1,2,1,3,4],
            [5,12,2,6,10],
            [4,3,3,2,1,10,6],
            [2,1,1,3,3,1,1,1,1,3,3],
            [2,1,3,1,6,1,1,1,2]
        ];

        // Chuyển thành chuỗi "1,2,3"
        const rowStrings = rowClues.map(arr => arr.join(','));
        const colStrings = colClues.map(arr => arr.join(','));

        // Đợi DOM cập nhật rồi điền
        setTimeout(() => {
            rowStrings.forEach((val, idx) => {
                const input = document.getElementById(`rowClue_${idx}`);
                if (input) input.value = val;
            });
            colStrings.forEach((val, idx) => {
                const input = document.getElementById(`colClue_${idx}`);
                if (input) input.value = val;
            });
        }, 100);
    }

    /**
     * Load example 25x25 từ dữ liệu cho sẵn
     */
    load25Example() {
        this.gridSizeInput.value = 25;
        this.currentSize = 25;
        this.createClueInputs(25);
        this.clearOutput();

        const rowClues = [
            [5,4,1,6,3],
            [5,3,1,4,3],
            [3,3,4,4,2],
            [3,10,1],
            [1,8,3],
            [1,1,1,2],
            [1,4,5],
            [9,2],
            [10,3],
            [1,5,2,1],
            [2,4,4,1,1],
            [1,3,3,3,1],
            [3,1,7,1],
            [2,1,1,2,8,1],
            [2,4,10,2],
            [1,2,5,1,2],
            [4,3],
            [3,4,4],
            [3,5,3],
            [3,8,1],
            [1,2,6,3],
            [1,1,10],
            [7,1,6],
            [6,4,4],
            [2,6,3,5]
        ];

        const colClues = [
            [6,1],
            [2,1,3,1,1],
            [5,1,2],
            [4,2,3],
            [4,6,3],
            [2,4,2,3],
            [6,2,4,3],
            [1,3,1,3,3],
            [1,1,2,1,1,3,2],
            [3,2,1,1],
            [2,2],
            [4,4,3],
            [3,16],
            [9,11,1],
            [3,3,10,2],
            [1,4,13],
            [1,2,4,4,2],
            [6,4,3],
            [5,5,3],
            [5,2,4],
            [4,2,4,5],
            [2,1,4],
            [7,1,3,5],
            [3,3,1,11],
            [2,1,1,3,5,3,1]
        ];

        // Đợi DOM cập nhật xong rồi điền giá trị
        setTimeout(() => {
            for (let i = 0; i < 25; i++) {
                const rowInput = document.getElementById(`rowClue_${i}`);
                if (rowInput) rowInput.value = rowClues[i].join(',');

                const colInput = document.getElementById(`colClue_${i}`);
                if (colInput) colInput.value = colClues[i].join(',');
            }
        }, 200);
    }
}