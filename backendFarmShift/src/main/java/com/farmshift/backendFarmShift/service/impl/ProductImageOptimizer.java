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
}
