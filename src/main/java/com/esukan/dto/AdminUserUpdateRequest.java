package com.esukan.dto;

import com.esukan.model.UserRole;

public record AdminUserUpdateRequest(
        UserRole role,
        Boolean enabled
) {}
