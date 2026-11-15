# React + Vite

## Kiểm tra camera điện thoại sau khi triển khai

- Triển khai cả frontend và backend. Mở frontend bằng tên miền HTTPS mà điện thoại truy cập được. Cấu hình Vercel hiện có chuyển đường dẫn `/phone-camera` về ứng dụng React.
- Nếu backend chạy trên tên miền riêng, đặt `VITE_API_URL=https://<backend>/api` trên frontend trước khi build. Với tên miền frontend riêng ngoài Vercel, đặt `APP_CORS_CAMERA_WEB_ORIGIN=https://<frontend>` trên backend. Nếu dùng cùng tên miền, chuyển tiếp `/api/` đến backend và giữ giá trị mặc định `/api`.
- Trên máy tính, đăng nhập chủ trại, vào **Thiết bị IoT**, mở chuồng và lấy mã QR trên tên miền đã triển khai. Dùng 4G trên điện thoại để quét mã, bấm **Bắt đầu phát** và cấp quyền camera. Trang phát mở được từ liên kết ghép nối mà không cần đăng nhập trên điện thoại.
- Xác nhận hình ảnh xuất hiện ở đúng chuồng. Giữ trang phát mở khi thử và dùng **Ngắt camera** để thu hồi mã.
- Phiên ghép nối và ảnh mới nhất nằm trong bộ nhớ backend. Khi thử nghiệm, dùng một instance backend. Nếu khởi động lại backend, mở lại chi tiết chuồng để lấy mã mới.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
