package com.esukan.dto;

import com.esukan.model.UserRole;

public record AdminCreateUserRequest(
        String username,
        String email,
        String password,
        String fullName,
        String studentIdNumber,
        UserRole role
) {}
