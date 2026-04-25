/**
 * Main Entry Point
 * Khởi tạo ứng dụng khi DOM loaded
 */

document.addEventListener('DOMContentLoaded', () => {
    // Khởi tạo UI Handler
    const uiHandler = new UIHandler();
    
    // Tạo bảng nhập mặc định (5x5)
    uiHandler.createClueInputs(5);
    
    console.log('🧩 Nonogram Solver đã sẵn sàng!');
    
    // Export UI handler ra global scope để có thể debug
    window.uiHandler = uiHandler;
});