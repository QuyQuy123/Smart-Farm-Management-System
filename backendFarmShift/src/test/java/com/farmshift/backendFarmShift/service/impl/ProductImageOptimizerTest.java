package com.farmshift.backendFarmShift.service.impl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import com.farmshift.backendFarmShift.exception.BadRequestException;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.*;
import static org.junit.jupiter.api.Assertions.*;
class ProductImageOptimizerTest {
 @TempDir Path directory;
 static byte[] image(String format, int width, int height, boolean alpha) throws Exception {
   var image = new BufferedImage(width, height, alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
   var random = new java.util.Random(42);
   for (int y=0;y<height;y++) for(int x=0;x<width;x++) image.setRGB(x,y,random.nextInt() | (alpha ? 0x60000000 : 0xff000000));
   var output = new ByteArrayOutputStream(); ImageIO.write(image, format, output); return output.toByteArray();
 }
 @Test void boundsJpegDimensionsAndReducesTransferSize() throws Exception {
   byte[] original = image("jpeg", 1600, 1200, false);
   var result = ProductImageOptimizer.optimize(original);
   var decoded = ImageIO.read(new ByteArrayInputStream(result.bytes()));
   assertEquals(1024,decoded.getWidth()); assertEquals(768,decoded.getHeight());
   assertTrue(result.bytes().length < original.length); assertEquals("image/jpeg",result.contentType());
 }
 @Test void preservesTransparencyAndDoesNotUpscale() throws Exception {
   var result = ProductImageOptimizer.optimize(image("png", 80, 60, true));
   var decoded = ImageIO.read(new ByteArrayInputStream(result.bytes()));
   assertTrue(decoded.getColorModel().hasAlpha()); assertEquals(80,decoded.getWidth());
 }
 @Test void keepsGifBytesAndRejectsInvalidData() throws Exception {
   var gif=image("gif", 20, 20, false);
   assertArrayEquals(gif,ProductImageOptimizer.optimize(gif).bytes());
   assertThrows(BadRequestException.class, () -> ProductImageOptimizer.optimize(new byte[]{1,2,3}));
 }
 @Test void storesOptimizedProductPhotosLocally() throws Exception {
   var service = new LocalFileUploadService(directory.toString());
   var url = service.uploadFile(new MockMultipartFile("file","large.jpg","image/jpeg",image("jpeg",1600,1200,false)),"products");
   var file=directory.resolve(url.substring("/img/".length()));
   assertTrue(Files.exists(file)); assertEquals(1024,ImageIO.read(file.toFile()).getWidth());
 }
 @Test void respectsPhonePhotoOrientation() throws Exception {
   byte[] jpeg=image("jpeg",1600,1200,false);
   byte[] exif={ 'E','x','i','f',0,0, 'I','I',42,0,8,0,0,0, 1,0, 18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0 };
   var stream=new ByteArrayOutputStream(); stream.write(jpeg,0,2); stream.write(255); stream.write(225); stream.write(0); stream.write(exif.length+2); stream.write(exif); stream.write(jpeg,2,jpeg.length-2);
   var decoded=ImageIO.read(new ByteArrayInputStream(ProductImageOptimizer.optimize(stream.toByteArray()).bytes()));
   assertEquals(768,decoded.getWidth()); assertEquals(1024,decoded.getHeight());
 }
}
