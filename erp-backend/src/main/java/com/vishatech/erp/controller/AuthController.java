package com.vishatech.erp.controller;

import com.vishatech.erp.dto.ApiResponse;
import com.vishatech.erp.dto.AuthResponse;
import com.vishatech.erp.dto.LoginRequest;
import com.vishatech.erp.dto.RegisterRequest;
import com.vishatech.erp.dto.UserResponse;
import com.vishatech.erp.entity.User;
import com.vishatech.erp.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(authService.login(request)));
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(authService.register(request)));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> me(Authentication authentication) {
        User user = authService.getCurrentUser(authentication.getName());
        UserResponse response = new UserResponse(user.getId(), user.getFullName(), user.getEmail(),
                user.getRole().name(), user.isEnabled());
        return ResponseEntity.ok(ApiResponse.ok(response));
    }
}
