package com.farmshift.backendFarmShift.service.ocr;

import com.farmshift.backendFarmShift.exception.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.nio.file.*;
import java.io.*;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.apache.pdfbox.Loader;

@Service
public class WeightSlipStorage {
    private final Path directory;
    public record Document(byte[] bytes, String mime, String extension) {}
    public WeightSlipStorage(@Value("${sales.weight-slips.directory:}") String configured) {
        Path cwd = Path.of(System.getProperty("user.dir")).toAbsolutePath();
        Path frontend = Files.isDirectory(cwd.resolve("frontendFarmShift")) ? cwd.resolve("frontendFarmShift") : cwd.resolve("../frontendFarmShift");
        directory = (configured.isBlank() ? frontend.resolve("public/weigh-slips") : Path.of(configured)).toAbsolutePath().normalize();
    }
    public Document validate(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > 10 * 1024 * 1024)
            throw new BadRequestException("Phiếu cân phải có dung lượng từ 1 byte đến 10MB.");
        try {
            byte[] bytes = file.getBytes();
            if (bytes.length >= 5 && new String(bytes, 0, 5, java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-")) {
                try (var pdf = Loader.loadPDF(bytes)) {
                    if (pdf.getNumberOfPages() > 4) throw new BadRequestException("Phiếu cân tối đa 4 trang.");
                }
                return new Document(bytes, "application/pdf", ".pdf");
            }
            try (var stream = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                var readers = ImageIO.getImageReaders(stream);
                if (!readers.hasNext()) throw new BadRequestException("Chỉ hỗ trợ ảnh JPG, PNG hoặc PDF hợp lệ.");
                var reader = readers.next();
                try {
                    reader.setInput(stream);
                    String format = reader.getFormatName().toLowerCase(java.util.Locale.ROOT);
                    if (!format.equals("jpeg") && !format.equals("png")) throw new BadRequestException("Chỉ hỗ trợ JPG, PNG hoặc PDF.");
                    if ((long)reader.getWidth(0) * reader.getHeight(0) > 25_000_000) throw new BadRequestException("Ảnh tối đa 25 megapixel.");
                    if (reader.read(0) == null) throw new BadRequestException("Ảnh không hợp lệ.");
                    return new Document(bytes, format.equals("png") ? "image/png" : "image/jpeg", format.equals("png") ? ".png" : ".jpg");
                } finally { reader.dispose(); }
            }
        } catch (BadRequestException ex) { throw ex; }
        catch (IOException ex) { throw new BadRequestException("Không đọc được tệp phiếu cân."); }
    }
    public String save(MultipartFile file) {
        var document = validate(file);
        try {
            Files.createDirectories(directory);
            String name = UUID.randomUUID() + document.extension();
            Files.write(directory.resolve(name), document.bytes(), StandardOpenOption.CREATE_NEW);
            return "/weigh-slips/" + name;
        } catch (IOException ex) { throw new IllegalStateException("Không thể lưu bản gốc phiếu cân.", ex); }
    }
    public void delete(String url) {
        if (url == null || !url.matches("/weigh-slips/[a-f0-9-]+\\.(jpg|png|pdf)")) return;
        try { Files.deleteIfExists(directory.resolve(url.substring("/weigh-slips/".length()))); }
        catch (IOException ignored) { /* Preserve the original transaction failure. */ }
    }
}
