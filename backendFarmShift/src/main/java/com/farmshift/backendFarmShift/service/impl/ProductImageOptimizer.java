package com.farmshift.backendFarmShift.service.impl;

import com.farmshift.backendFarmShift.exception.BadRequestException;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

/** Product photos are displayed as small thumbnails; bound their stored resolution. */
final class ProductImageOptimizer {
    private ProductImageOptimizer() {}
    record Result(byte[] bytes, String extension, String contentType) {}
    static Result optimize(byte[] bytes) throws IOException {
        String format;
        try (var stream = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) throw new BadRequestException("Ảnh hàng hóa không hợp lệ.");
            var reader = readers.next();
            try {
                reader.setInput(stream);
                format = reader.getFormatName().toLowerCase(java.util.Locale.ROOT);
                long pixels = (long) reader.getWidth(0) * reader.getHeight(0);
                if (pixels > 25_000_000) throw new BadRequestException("Ảnh hàng hóa quá lớn, vui lòng chọn ảnh dưới 25 megapixel.");
            } finally { reader.dispose(); }
        }
        if (format.equals("gif")) return new Result(bytes, ".gif", "image/gif"); // Preserve animation.
        if (!format.equals("jpeg") && !format.equals("jpg") && !format.equals("png")) throw new BadRequestException("Chỉ hỗ trợ ảnh PNG, JPEG hoặc GIF.");
        var source = ImageIO.read(new ByteArrayInputStream(bytes));
        if (source == null) throw new BadRequestException("Ảnh hàng hóa không hợp lệ.");
        boolean alpha = source.getColorModel().hasAlpha();
        double scale = Math.min(1.0, 1024.0 / Math.max(source.getWidth(), source.getHeight()));
        int width = Math.max(1, (int) Math.round(source.getWidth() * scale));
        int height = Math.max(1, (int) Math.round(source.getHeight() * scale));
        var resized = new BufferedImage(width, height, alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        var graphics = resized.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.drawImage(source, 0, 0, width, height, null);
        } finally { graphics.dispose(); }
        int orientation = jpegOrientation(bytes);
        if (orientation > 1) resized = orient(resized, orientation);
        var output = new ByteArrayOutputStream();
        String targetFormat = alpha ? "png" : "jpeg";
        var writer = ImageIO.getImageWritersByFormatName(targetFormat).next();
        try (var stream = ImageIO.createImageOutputStream(output)) {
            writer.setOutput(stream);
            var params = writer.getDefaultWriteParam();
            if (!alpha) { params.setCompressionMode(ImageWriteParam.MODE_EXPLICIT); params.setCompressionQuality(0.82f); }
            writer.write(null, new javax.imageio.IIOImage(resized, null, null), params);
        } finally { writer.dispose(); }
        byte[] optimized = output.toByteArray();
        // Do not increase transfer size for an already optimized image.
        if (optimized.length >= bytes.length && scale == 1.0) return new Result(bytes, format.equals("png") ? ".png" : ".jpg", format.equals("png") ? "image/png" : "image/jpeg");
        return new Result(optimized, alpha ? ".png" : ".jpg", alpha ? "image/png" : "image/jpeg");
    }
    private static BufferedImage orient(BufferedImage source, int orientation) {
        int w = source.getWidth(), h = source.getHeight();
        var result = new BufferedImage(orientation >= 5 ? h : w, orientation >= 5 ? w : h, source.getType());
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
            int dx = x, dy = y;
            switch (orientation) {
                case 2 -> dx = w - 1 - x;
                case 3 -> { dx = w - 1 - x; dy = h - 1 - y; }
                case 4 -> dy = h - 1 - y;
                case 5 -> { dx = y; dy = x; }
                case 6 -> { dx = h - 1 - y; dy = x; }
                case 7 -> { dx = h - 1 - y; dy = w - 1 - x; }
                case 8 -> { dx = y; dy = w - 1 - x; }
                default -> { }
            }
            result.setRGB(dx, dy, source.getRGB(x, y));
        }
        return result;
    }
    private static int jpegOrientation(byte[] bytes) {
        if (bytes.length < 4 || (bytes[0] & 255) != 255 || (bytes[1] & 255) != 216) return 1;
        try {
            int offset = 2;
            while (offset + 4 <= bytes.length && (bytes[offset] & 255) == 255) {
                int marker = bytes[offset + 1] & 255;
                if (marker == 218 || marker == 217) break;
                int length = ((bytes[offset + 2] & 255) << 8) | (bytes[offset + 3] & 255);
                if (length < 2 || offset + 2L + length > bytes.length) break;
                int start = offset + 4, end = offset + 2 + length;
                if (marker == 225 && length >= 16 && bytes[start] == 'E' && bytes[start + 1] == 'x' && bytes[start + 2] == 'i' && bytes[start + 3] == 'f' && bytes[start + 4] == 0 && bytes[start + 5] == 0) {
                    var data = java.nio.ByteBuffer.wrap(bytes, start + 6, end - start - 6).slice();
                    if (data.getShort(0) == 0x4949) data.order(java.nio.ByteOrder.LITTLE_ENDIAN);
                    else if (data.getShort(0) != 0x4d4d) return 1;
                    if (data.getShort(2) != 42) return 1;
                    int directory = data.getInt(4);
                    if (directory < 8 || directory > data.limit() - 2) return 1;
                    int count = Short.toUnsignedInt(data.getShort(directory));
                    for (int i = 0; i < count; i++) {
                        long entry = directory + 2L + i * 12L;
                        if (entry > data.limit() - 12) return 1;
                        int pos = (int) entry;
                        if (Short.toUnsignedInt(data.getShort(pos)) == 274 && data.getShort(pos + 2) == 3 && data.getInt(pos + 4) == 1) {
                            int orientation = Short.toUnsignedInt(data.getShort(pos + 8));
                            return orientation >= 1 && orientation <= 8 ? orientation : 1;
                        }
                    }
                }
                offset = end;
            }
        } catch (IndexOutOfBoundsException ignored) { /* Ignore incomplete optional EXIF metadata. */ }
        return 1;
    }

}
