package com.vishatech.erp.service;

import com.vishatech.erp.dto.AuthResponse;
import com.vishatech.erp.dto.LoginRequest;
import com.vishatech.erp.dto.RegisterRequest;
import com.vishatech.erp.entity.User;
import com.vishatech.erp.entity.UserRole;
import com.vishatech.erp.exception.DuplicateResourceException;
import com.vishatech.erp.exception.ResourceNotFoundException;
import com.vishatech.erp.repository.UserRepository;
import com.vishatech.erp.security.CustomUserDetailsService;
import com.vishatech.erp.security.JwtService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;

    public AuthService(AuthenticationManager authenticationManager,
                       UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       CustomUserDetailsService userDetailsService) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email().trim(), request.password()));
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        User user = userRepository.findByEmail(request.email().trim())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return toAuthResponse(user, jwtService.generateToken(userDetails));
    }

    public AuthResponse register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new DuplicateResourceException("Email already registered: " + email);
        }
        User user = new User();
        user.setFullName(request.fullName().trim());
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(UserRole.USER);
        if (request.role() != null && !request.role().isBlank()) {
            try {
                user.setRole(UserRole.valueOf(request.role().trim().toUpperCase()));
            } catch (IllegalArgumentException ignored) {
                user.setRole(UserRole.USER);
            }
        }
        userRepository.save(user);
        UserDetails userDetails = userDetailsService.loadUserByUsername(email);
        return toAuthResponse(user, jwtService.generateToken(userDetails));
    }

    public User getCurrentUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + email));
    }

    private AuthResponse toAuthResponse(User user, String token) {
        return new AuthResponse(token, "Bearer", user.getEmail(), user.getFullName(), user.getRole().name());
    }
}
