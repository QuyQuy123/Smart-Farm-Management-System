package com.farmshift.backendFarmShift.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.net.InetSocketAddress;
import java.nio.file.*;
import static org.junit.jupiter.api.Assertions.*;

class LocalAiServiceLauncherTest {
 @TempDir Path directory;
 @Test void selectsVirtualEnvironmentPythonAndAllowsOverride() throws Exception {
  boolean windows = System.getProperty("os.name").toLowerCase().contains("win");
  Path python = directory.resolve(windows ? "venv/Scripts/python.exe" : "venv/bin/python");
  Files.createDirectories(python.getParent()); Files.writeString(python, "");
  assertEquals(python.toString(), LocalAiServiceLauncher.resolvePython(directory, ""));
  assertEquals("custom-python", LocalAiServiceLauncher.resolvePython(directory, "custom-python"));
 }
 @Test void reusesAnExternalAiServiceAndDoesNotStopIt() throws Exception {
  var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
  server.createContext("/health", exchange -> {
   byte[] body = "{\"status\":\"healthy\",\"ocr_engine\":\"test\"}".getBytes();
   exchange.sendResponseHeaders(200, body.length); exchange.getResponseBody().write(body); exchange.close();
  });
  server.start();
  var launcher = new LocalAiServiceLauncher(new ObjectMapper(), "http://127.0.0.1:" + server.getAddress().getPort(), directory.toString(), "nonexistent-python", 1);
  try {
   launcher.start(); assertTrue(launcher.healthy()); launcher.stop(); assertTrue(launcher.healthy());
  } finally { launcher.stop(); server.stop(0); }
 }
 @Test void startsAndStopsOnlyItsOwnChild() throws Exception {
  // A tiny uvicorn substitute verifies process ownership without importing AI libraries or calling GPT.
  Files.writeString(directory.resolve("main.py"), "# test-only entry point");
  Path module = directory.resolve("uvicorn"); Files.createDirectories(module); Files.writeString(module.resolve("__init__.py"), "");
  Files.writeString(module.resolve("__main__.py"), """
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        data=b'{"status":"healthy","ocr_engine":"test"}'
        self.send_response(200); self.end_headers(); self.wfile.write(data)
port=int(sys.argv[sys.argv.index('--port')+1])
HTTPServer(('127.0.0.1',port), Handler).serve_forever()
""");
  int port;
  try (var socket = new java.net.ServerSocket(0)) { port = socket.getLocalPort(); }
  var launcher = new LocalAiServiceLauncher(new ObjectMapper(), "http://127.0.0.1:" + port, directory.toString(), "", 10);
  try { launcher.start(); assertTrue(launcher.healthy()); }
  finally { launcher.stop(); }
  assertFalse(launcher.healthy());
 }
 @Test void neverLaunchesForARemoteEndpoint() {
  var launcher = new LocalAiServiceLauncher(new ObjectMapper(), "https://example.invalid", directory.toString(), "nonexistent-python", 1);
  launcher.start(); launcher.stop();
 }
}
