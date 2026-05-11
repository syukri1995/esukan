package com.esukan.dto;

public record ResetPasswordRequest(String token, String newPassword) {}
