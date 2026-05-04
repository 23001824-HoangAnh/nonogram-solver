class NonogramSolver {
    /* ================================================================
       PATTERN COUNTING (DP) – Đếm chính xác số pattern hợp lệ
       ================================================================ */
    static countPatternsDP(length, clues, known = null) {
        if (!clues || clues.length === 0) {
            // Nếu không có manh mối, cách duy nhất là toàn số 0.
            // Cần kiểm tra xem có ô nào bị ép là 1 trong mảng known không.
            if (known && known.includes(1)) return 0n;
            return 1n;
        }

        // Nếu không truyền known (chưa biết gì), mặc định là toàn -1
        if (!known) {
            known = new Array(length).fill(-1);
        }

        const K = clues.length;
        
        // dp[i][k] = Số cách hợp lệ để xếp k khối đầu tiên vào i ô đầu tiên của hàng.
        // i chạy từ 0 đến length, k chạy từ 0 đến K.
        const dp = Array.from({ length: length + 1 }, () => new Array(K + 1).fill(0n));
        
        // Base case: 0 ô, 0 khối -> có đúng 1 cách (không đặt gì cả)
        dp[0][0] = 1n; 

        for (let i = 1; i <= length; i++) {
            const knownIdx = i - 1; // Chỉ số thực tế đang xét trong mảng known
            
            for (let k = 0; k <= K; k++) {
                let ways = 0n;

                // TRƯỜNG HỢP 1: Quyết định đặt ô trống (0) tại vị trí i-1
                // Chỉ hợp lệ nếu ô này không bị xác định từ trước là 1
                if (known[knownIdx] !== 1) {
                    ways += dp[i - 1][k];
                }

                // TRƯỜNG HỢP 2: Quyết định đặt khối thứ k sao cho nó KẾT THÚC tại vị trí i-1
                if (k > 0) {
                    const L = clues[k - 1]; // Độ dài của khối hiện tại
                    
                    if (i >= L) {
                        // Kiểm tra xem khoảng không gian độ dài L này có hợp lệ không
                        // (Không được chứa ô nào đã được xác định là 0)
                        let canPlaceBlock = true;
                        for (let j = 0; j < L; j++) {
                            if (known[knownIdx - j] === 0) {
                                canPlaceBlock = false;
                                break;
                            }
                        }

                        if (canPlaceBlock) {
                            if (k === 1) {
                                // Nếu là khối đầu tiên, ta có thể đặt sát lề hoặc bất cứ đâu
                                // Các ô đằng trước nó bắt buộc phải là 0 (đã được bao hàm ở dp[i-L][0])
                                ways += dp[i - L][0];
                            } else {
                                // Nếu là khối thứ 2 trở đi, BẮT BUỘC phải có ít nhất 1 ô trống (0) ngăn cách trước nó.
                                // Tức là ô tại vị trí (knownIdx - L) không được phép là 1.
                                if (i > L && known[knownIdx - L] !== 1) {
                                    // Chuyển trạng thái từ dp[i - L - 1][k - 1] (đã tính cả khoảng trắng)
                                    ways += dp[i - L - 1][k - 1];
                                }
                            }
                        }
                    }
                }
                
                dp[i][k] = ways;
            }
        }

        // Trả về số cách để xếp đủ K khối trong length ô
        return dp[length][K];
    }

    /* ================================================================
       LINE ANALYSIS (DP) – tìm ô chắc chắn mà không cần sinh pattern
       ================================================================ */
    static lineOverlapDP(length, clues, known) {
        // known: mảng -1/0/1
        // Trả về alwaysOne, alwaysZero
        if (!clues || clues.length === 0) {
            return {
                alwaysOne: new Array(length).fill(false),
                alwaysZero: new Array(length).fill(true)  // tất cả phải 0
            };
        }
        const K = clues.length;
        // Tính earliest_start[k] và latest_start[k]
        const earliest = new Array(K).fill(0);
        const latest = new Array(K).fill(0);
        // Quét từ trái: earliest start
        let pos = 0;
        for (let k = 0; k < K; k++) {
            // đặt earliest sao cho không vi phạm known = 1 trước đó (nhưng không bắt buộc)
            while (pos < length && !NonogramSolver.canPlaceBlockAt(known, pos, clues[k], length)) pos++;
            earliest[k] = pos;
            pos += clues[k] + 1; // +1 cho khoảng trắng sau (nếu không phải block cuối)
        }
        // Quét từ phải: latest start
        pos = length;
        for (let k = K-1; k >= 0; k--) {
            while (pos > 0 && pos - clues[k] >= 0 &&
                   !NonogramSolver.canPlaceBlockAt(known, pos - clues[k], clues[k], length)) pos--;
            latest[k] = pos - clues[k];
            pos = latest[k] - 1; // -1 cho khoảng trắng trước
        }
        // Xác định ô chắc chắn
        const alwaysOne = new Array(length).fill(false);
        const alwaysZero = new Array(length).fill(true);
        // Mảng đánh dấu ô có thể là 1
        const possibleOne = new Array(length).fill(false);
        for (let k = 0; k < K; k++) {
            for (let start = earliest[k]; start <= latest[k]; start++) {
                if (NonogramSolver.canPlaceBlockAt(known, start, clues[k], length)) {
                    for (let i = 0; i < clues[k]; i++) possibleOne[start+i] = true;
                }
            }
        }
        // Kiểm tra ô luôn là 1: nếu với mọi cách đặt, ô đó đều là 1?
        // Không đơn giản, ta dùng phương pháp đếm khoảng sớm/muộn cho từng ô.
        // Thay vào đó dùng kỹ thuật "overlap": nếu earliest[k] + length - 1 >= latest[k] thì 
        // các ô từ latest[k] đến earliest[k]+length-1 chắc chắn là 1.
        for (let k = 0; k < K; k++) {
            const blockStartMin = earliest[k];
            const blockStartMax = latest[k];
            if (blockStartMin + clues[k] - 1 >= blockStartMax) {
                const overlapStart = blockStartMax;
                const overlapEnd = blockStartMin + clues[k] - 1;
                for (let i = overlapStart; i <= overlapEnd; i++) {
                    alwaysOne[i] = true;
                }
            }
        }
        // alwaysZero: ô nào không thể là 1 và không đã biết là 1
        for (let i = 0; i < length; i++) {
            if (known[i] == 1) alwaysZero[i] = false;
            else if (!possibleOne[i]) alwaysZero[i] = true;
            else alwaysZero[i] = false;
        }
        return { alwaysOne, alwaysZero };
    }

    static canPlaceBlockAt(known, start, len, totalLen) {
        if (start < 0 || start + len > totalLen) return false;
        // Kiểm tra không có ô 0 trong vùng, và ô 1 khớp (nếu có)
        for (let i = 0; i < len; i++) {
            if (known[start+i] === 0) return false;
        }
        // Ô ngay trước (nếu start>0) phải là 0 (hoặc -1)
        if (start > 0 && known[start-1] === 1) return false;
        // Ô ngay sau (nếu start+len < totalLen) phải là 0 (hoặc -1)
        if (start+len < totalLen && known[start+len] === 1) return false;
        return true;
    }

    /* ================================================================
       LINE SOLVING COMBINED (Overlap + Edge + Counting)
       ================================================================ */
    static applyLineLogicEnhanced(lineLength, clues, known) {
        let cur = known.slice();
        const overlapRes = NonogramSolver.lineOverlapDP(lineLength, clues, cur);
        let changed = false;
        for (let i = 0; i < lineLength; i++) {
            if (overlapRes.alwaysOne[i] && cur[i] === -1) { cur[i] = 1; changed = true; }
            if (overlapRes.alwaysZero[i] && cur[i] === -1) { cur[i] = 0; changed = true; }
        }
        // Edge logic (đơn giản)
        if (clues.length > 0) {
            // ==========================================
            // 1. XỬ LÝ ĐẦU TRÁI (Tìm "góc chết" bên trái)
            // ==========================================
            const firstLen = clues[0];
            let firstValidStart = 0;

            // Quét từ trái sang phải để tìm vị trí SỚM NHẤT đặt vừa khối đầu tiên
            while (firstValidStart <= lineLength - firstLen) {
                let canFit = true;
                for (let j = 0; j < firstLen; j++) {
                    // Nếu vướng ô số 0, khoảng này quá hẹp
                    if (cur[firstValidStart + j] === 0) {
                        canFit = false;
                        break;
                    }
                }
                if (canFit) break; // Đã tìm thấy vị trí đặt vừa!
                firstValidStart++;
            }

            // Những ô nằm TRƯỚC firstValidStart chắc chắn không thể nhét vừa khối đầu.
            // Lấp 0 vào tất cả những ô chưa biết (-1) ở khu vực này.
            for (let i = 0; i < firstValidStart; i++) {
                if (cur[i] === -1) { 
                    cur[i] = 0; 
                    changed = true; 
                }
            }

            // ==========================================
            // 2. XỬ LÝ ĐẦU PHẢI (Tìm "góc chết" bên phải)
            // ==========================================
            const lastLen = clues[clues.length - 1];
            let lastValidEnd = lineLength - 1; // Tính theo điểm KẾT THÚC của khối cuối

            // Quét từ phải sang trái để tìm vị trí MUỘN NHẤT đặt vừa khối cuối cùng
            while (lastValidEnd >= lastLen - 1) {
                let canFit = true;
                for (let j = 0; j < lastLen; j++) {
                    // Kiểm tra lùi lại lastLen ô xem có vướng số 0 nào không
                    if (cur[lastValidEnd - j] === 0) {
                        canFit = false;
                        break;
                    }
                }
                if (canFit) break; // Đã tìm thấy vị trí đặt vừa!
                lastValidEnd--;
            }

            // Những ô nằm SAU lastValidEnd chắc chắn khối cuối không thể vươn tới được.
            // Lấp 0 vào tất cả những ô chưa biết (-1) ở khu vực này.
            for (let i = lastValidEnd + 1; i < lineLength; i++) {
                if (cur[i] === -1) { 
                    cur[i] = 0; 
                    changed = true; 
                }
            }
        }
        // Counting
        const known1 = cur.filter(v=>v===1).length;
        const needed = clues.reduce((a,b)=>a+b,0);
        if (known1 === needed) {
            for (let i = 0; i < lineLength; i++) {
                if (cur[i] === -1) { cur[i] = 0; changed = true; }
            }
        }
        return changed ? cur : null;
    }

    /* ================================================================
       GRID REDUCTION ITERATIVE
       ================================================================ */
    static reduceGridWithLogic(initialKnown, rowClues, colClues) {
        const rows = rowClues.length;
        const cols = colClues.length;
        let known = initialKnown.map(row => row.slice());
        let changed = true;
        let loop = 0;
        const maxLoop = 100;
        while (changed && loop < maxLoop) {
            changed = false; loop++;
            // Rows
            for (let r = 0; r < rows; r++) {
                const newLine = NonogramSolver.applyLineLogicEnhanced(cols, rowClues[r], known[r]);
                if (newLine) {
                    for (let c = 0; c < cols; c++) {
                        if (newLine[c] !== known[r][c]) {
                            known[r][c] = newLine[c];
                            changed = true;
                        }
                    }
                }
            }
            // Columns
            for (let c = 0; c < cols; c++) {
                const colKnown = known.map(row => row[c]);
                const newCol = NonogramSolver.applyLineLogicEnhanced(rows, colClues[c], colKnown);
                if (newCol) {
                    for (let r = 0; r < rows; r++) {
                        if (newCol[r] !== known[r][c]) {
                            known[r][c] = newCol[r];
                            changed = true;
                        }
                    }
                }
            }
        }
        const unknownCnt = known.flat().filter(v=>v=== -1).length;
        return { known, unknownCnt };
    }

    /* ================================================================
       BACKTRACKING (với giới hạn pattern)
       ================================================================ */
    static solveWithBacktrack(rowClues, colClues, knownParam, maxPatternsPerLine = 5000) {
        const rows = rowClues.length;
        const cols = colClues.length;
        let known = knownParam.map(r => r.slice());
        // Xác định các dòng chưa hoàn toàn xác định
        const undeterminedRows = [];
        for (let r = 0; r < rows; r++) {
            if (known[r].some(v => v === -1)) undeterminedRows.push(r);
        }
        // Sinh trước tất cả pattern cho từng hàng, lọc bởi known hiện tại
        // ... (Trong hàm solveWithBacktrack) ...
        const patterns = {};
        const patternCounts = {}; // Lưu số lượng đếm được bằng DP
        let totalPatterns = 1;
        
        for (const r of undeterminedRows) {
            // DÙNG DP ĐỂ TÍNH NHANH SỐ LƯỢNG PATTERN HỢP LỆ
            const count = NonogramSolver.countPatternsDP(cols, rowClues[r], known[r]);
            
            if (count === 0n) return null; // Mâu thuẫn
            
            // Ép kiểu BigInt về Number (vì maxPatternsPerLine nhỏ, sẽ không tràn số)
            const numCount = Number(count); 
            patternCounts[r] = numCount;

            if (numCount > maxPatternsPerLine) {
                // Quá nhiều pattern, fallback ngay lập tức KHÔNG CẦN sinh mảng
                return { fallback: true };
            }

            // Nếu số lượng an toàn, lúc này mới sinh mảng thật
            const allPats = NonogramSolver.generatePatterns(cols, rowClues[r]);
            const filtered = allPats.filter(p => {
                for (let c = 0; c < cols; c++) {
                    if (known[r][c] !== -1 && known[r][c] !== p[c]) return false;
                }
                return true;
            });
            
            patterns[r] = filtered;
            totalPatterns *= filtered.length;
            if (totalPatterns > 1e6) {
                return { fallback: true };
            }
        }
        
        // Sắp xếp các hàng theo MRV (tăng dần)
        undeterminedRows.sort((a,b) => patternCounts[a] - patternCounts[b]);
        // Backtrack
        const grid = known.map(row => row.map(c => c === -1 ? 0 : c)); // tạm gán 0 cho ô chưa biết khi thử
        function backtrack(idx) {
            if (idx === undeterminedRows.length) {
                return NonogramSolver.isValidComplete(grid, colClues) ? grid.map(r=>[...r]) : null;
            }
            const r = undeterminedRows[idx];
            const pats = patterns[r];
            for (const pat of pats) {
                const oldRow = grid[r];
                grid[r] = pat;
                if (NonogramSolver.isValidPartial(grid, colClues, r)) {
                    const res = backtrack(idx+1);
                    if (res) return res;
                }
                grid[r] = oldRow;
            }
            return null;
        }
        return backtrack(0) || null;
    }

    /* ================================================================
       Các hàm validate 
       ================================================================ */
    static isValidPartial(grid, colClues, rowIdx) {
        const cols = grid[0].length;
        for (let c = 0; c < cols; c++) {
            const colVals = [];
            for (let r = 0; r <= rowIdx; r++) colVals.push(grid[r][c]);
            const clues = colClues[c];
            const groups = [];
            let count = 0;
            for (const v of colVals) {
                if (v === 1) count++;
                else { if (count > 0) { groups.push(count); count = 0; } }
            }
            if (count > 0) groups.push(count);
            if (groups.length > clues.length) return false;
            for (let i = 0; i < groups.length; i++) {
                const isComplete = i < groups.length - 1 || (rowIdx + 1 < grid.length && colVals[colVals.length - 1] === 0);
                if (isComplete) { if (groups[i] !== clues[i]) return false; }
                else { if (groups[i] > clues[i]) return false; }
            }
        }
        return true;
    }
    static isValidComplete(grid, colClues) {
        const rows = grid.length;
        const cols = grid[0].length;
        for (let c = 0; c < cols; c++) {
            const colVals = [];
            for (let r = 0; r < rows; r++) colVals.push(grid[r][c]);
            const clues = colClues[c];
            const groups = [];
            let count = 0;
            for (const v of colVals) {
                if (v === 1) count++;
                else { if (count > 0) { groups.push(count); count = 0; } }
            }
            if (count > 0) groups.push(count);
            if (groups.length !== clues.length) return false;
            for (let i = 0; i < groups.length; i++) {
                if (groups[i] !== clues[i]) return false;
            }
        }
        return true;
    }
    static generatePatterns(length, clues) {
        if (!clues || clues.length === 0) return [new Array(length).fill(0)];

        function helper(clues, length) {
            if (!clues || clues.length === 0) return [new Array(length).fill(0)];

            const first = clues[0];
            const rest = clues.slice(1);
            const patterns = [];
            const totalBlocks = clues.reduce((s, c) => s + c, 0) + clues.length - 1;
            const maxStart = length - totalBlocks;

            for (let start = 0; start <= maxStart; start++) {
                const prefix = [...new Array(start).fill(0), ...new Array(first).fill(1)];
                if (rest.length > 0) {
                    if (start + first + 1 > length) continue;
                    const suffixPatterns = helper(rest, length - start - first - 1);
                    for (const suf of suffixPatterns) {
                        patterns.push([...prefix, 0, ...suf]);
                    }
                } else {
                    const tail = new Array(length - start - first).fill(0);
                    patterns.push([...prefix, ...tail]);
                }
            }
            return patterns;
        }
        return helper(clues, length);
    }

    /* ================================================================
       MAIN SOLVER – phối hợp logic reduction + backtracking + server fallback
       ================================================================ */
    static solve(rowClues, colClues, options = {}) {
        const rows = rowClues.length;
        const cols = colClues.length;
        // 1. Logic reduction
        const emptyKnown = Array(rows).fill().map(() => Array(cols).fill(-1));
        const reduction = NonogramSolver.reduceGridWithLogic(emptyKnown, rowClues, colClues);
        if (reduction.unknownCnt === 0) {
            return reduction.known.map(row => row.map(c => c===-1?0:c)); // đã giải
        }
        if (reduction.unknownCnt > 800 && !options.forceBacktrack) {
            // Quá nhiều ô chưa biết, đề xuất dùng server
            return { partial: reduction.known, suggestServer: true };
        }
        // 2. Thử backtracking
        const btResult = NonogramSolver.solveWithBacktrack(rowClues, colClues, reduction.known, 3000);
        if (btResult && typeof btResult.fallback !== 'undefined') {
            return { partial: reduction.known, suggestServer: true };
        }
        if (btResult) return btResult;
        return null; // impossible hoặc fallback
    }

    static validateClues(rowClues, colClues) {
        const rowSum = rowClues.flat().reduce((a,b)=>a+b,0);
        const colSum = colClues.flat().reduce((a,b)=>a+b,0);
        return rowSum === colSum;
    }
}

if (typeof module !== 'undefined') module.exports = NonogramSolver;
