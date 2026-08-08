package com.vishatech.erp.service;

import com.vishatech.erp.exception.BadRequestException;
import com.vishatech.erp.exception.ResourceNotFoundException;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class FileStorageService {

    private final Path rootLocation;

    public FileStorageService(@Value("${app.upload.dir}") String uploadDir) {
        this.rootLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(rootLocation);
        } catch (IOException e) {
            throw new IllegalStateException("Could not create upload directory", e);
        }
    }

    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File is empty");
        }
        String original = file.getOriginalFilename() == null ? "file" : file.getOriginalFilename();
        String extension = "";
        int dot = original.lastIndexOf('.');
        if (dot > 0) {
            extension = original.substring(dot);
        }
        String storedName = UUID.randomUUID().toString().replace("-", "") + extension;
        try {
            Path target = rootLocation.resolve(storedName).normalize();
            if (!target.startsWith(rootLocation)) {
                throw new BadRequestException("Invalid file path");
            }
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return storedName;
        } catch (IOException e) {
            throw new IllegalStateException("Failed to store file", e);
        }
    }

    public Resource loadAsResource(String storedName) {
        try {
            Path file = rootLocation.resolve(storedName).normalize();
            if (!file.startsWith(rootLocation)) {
                throw new BadRequestException("Invalid file path");
            }
            Resource resource = new UrlResource(file.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            }
            throw new ResourceNotFoundException("File not found: " + storedName);
        } catch (IOException e) {
            throw new ResourceNotFoundException("File not found: " + storedName);
        }
    }
}
