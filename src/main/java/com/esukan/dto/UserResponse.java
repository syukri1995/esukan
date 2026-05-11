package com.esukan.dto;

import com.esukan.model.UserRole;

public record UserResponse(
        Long id,
        String username,
        String email,
        String fullName,
        String studentIdNumber,
        UserRole role
) {}
