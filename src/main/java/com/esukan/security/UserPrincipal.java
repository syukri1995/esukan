package com.esukan.security;

import com.esukan.model.UserRole;

public class UserPrincipal {

    private final Long id;
    private final String username;
    private final String password;
    private final boolean enabled;
    private final UserRole role;
    private final String studentIdNumber;
    private final String email;
    private final String fullName;

    public UserPrincipal(Long id, String username, String password, boolean enabled,
                         UserRole role, String studentIdNumber, String email, String fullName) {
        this.id = id;
        this.username = username;
        this.password = password;
        this.enabled = enabled;
        this.role = role;
        this.studentIdNumber = studentIdNumber;
        this.email = email;
        this.fullName = fullName;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getPassword() {
        return password;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public UserRole getRole() {
        return role;
    }

    public String getStudentIdNumber() {
        return studentIdNumber;
    }

    public String getEmail() {
        return email;
    }

    public String getFullName() {
        return fullName;
    }
}
