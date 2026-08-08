package com.vishatech.erp.controller;

import com.vishatech.erp.dto.UserResponse;
import com.vishatech.erp.entity.User;
import com.vishatech.erp.repository.UserRepository;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/users")
public class UserController {

    private final UserRepository userRepository;

    public UserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<List<UserResponse>> list() {
        List<UserResponse> users = userRepository.findAll(Sort.by("fullName")).stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(users);
    }

    private UserResponse toResponse(User user) {
        return new UserResponse(user.getId(), user.getFullName(), user.getEmail(), user.getRole().name(),
                user.isEnabled());
    }
}
