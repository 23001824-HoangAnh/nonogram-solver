# 🧩 Nonogram Solver (Giải Puzzle đến 50x50)

Đây là ứng dụng web hỗ trợ giải các câu đố Nonogram (Hanjie/Picross/Griddlers) với kích thước từ 2x2 lên đến 50x50. Hệ thống sử dụng một thuật toán giải đa lớp thông minh, kết hợp giữa quy hoạch động (Dynamic Programming) trên trình duyệt và thuật toán tối ưu hóa (Integer Linear Programming - ILP) trên máy chủ để có thể xử lý mượt mà cả những câu đố lớn và cực kỳ phức tạp.

## ✨ Tính năng nổi bật

- **Chiến lược giải 3 lớp (3-layer strategy):**
  1. **Logic Reduction (Client-side):** Phân tích và giải quyết các ô chắc chắn bằng thuật toán quy hoạch động (DP) và Line Overlap ngay trên JavaScript. Giúp giải quyết nhanh một phần hoặc toàn bộ bảng.
  2. **Server ILP (Server-side):** Nếu thuật toán logic không thể giải xong (chỉ tìm được một phần), ứng dụng sẽ tự động gửi phần còn lại lên server Python. Máy chủ sử dụng mô hình CP-SAT (Google OR-Tools) để tìm ra kết quả cuối cùng.
  3. **Fallback JS Solver:** Nếu không có kết nối server, hệ thống sẽ tự động dùng thuật toán Backtracking trên trình duyệt đối với các bảng có kích thước nhỏ (≤ 20x20).
- **Hiển thị thông minh (Adaptive Rendering):** Giao diện tự động sử dụng HTML Canvas hiệu năng cao đối với các bảng lớn hơn 20x20 và sử dụng thẻ HTML Table dễ nhìn cho các bảng nhỏ (≤ 20x20).
- **Giao diện trực quan:** Hỗ trợ nhập liệu dễ dàng theo từng dòng/cột, thiết kế hiện đại và có hiển thị thông báo trạng thái hoạt động (loading, success, error).

## 📂 Cấu trúc dự án

- `index.html`: Giao diện chính của ứng dụng.
- `style.css`: Các định dạng giao diện, hiệu ứng CSS.
- `main.js`: Điểm bắt đầu của ứng dụng (Entry Point), khởi tạo `UIHandler` khi tải xong trang.
- `ui.js`: Chứa class `UIHandler`, đóng vai trò quản lý logic của giao diện, thu thập đầu vào, thực hiện gọi API server và render kết quả hiển thị.
- `solver.js`: Chứa class `NonogramSolver`, xử lý tất cả các thuật toán tính toán trên trình duyệt (Pattern Counting, Line Analysis, Edge Logic, Backtracking).
- `server.py`: Backend Flask xử lý các ma trận phức tạp bằng thư viện `ortools` (CP-SAT).

## 🚀 Hướng dẫn Cài đặt & Sử dụng

### 1. Yêu cầu hệ thống (Prerequisites)
- Trình duyệt web hiện đại (Chrome, Firefox, Edge, Safari...).
- **Python 3.7+** (Dành cho việc chạy Backend).

### 2. Cài đặt và khởi chạy Backend (Server ILP)
Server Python đảm nhận việc giải quyết các câu đố phức tạp hoặc có kích thước lớn (> 20x20).
- Mở terminal/command prompt và cài đặt các thư viện cần thiết:
  ```bash
  pip install flask flask-cors ortools
Khởi động server (Mặc định chạy tại port 5000):

Bash
python server.py
3. Khởi chạy Frontend
Bạn chỉ cần mở trực tiếp file index.html trong trình duyệt web, hoặc sử dụng các extension như Live Server (trên VSCode) để có trải nghiệm tốt nhất.

📖 Cách sử dụng
Mở ứng dụng, nhập kích thước bảng (từ 2 đến 50) và nhấn Enter hoặc nút tạo bảng.

Điền các gợi ý cho Dòng (Row Clues) và Cột (Column Clues). Các số cách nhau bằng dấu phẩy (VD: 2,1 hoặc 3,4,1).

Nhấn nút "🔍 Giải Puzzle".

Xem hệ thống hoạt động:

Nếu bảng đơn giản, ứng dụng sẽ giải ngay lập tức trên trình duyệt.

Nếu bảng khó, hệ thống sẽ gửi truy vấn tới server Python (lưu ý: thời gian chờ tối đa được thiết lập là 130 giây cho các bảng kích thước lớn).
