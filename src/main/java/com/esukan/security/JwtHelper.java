package com.esukan.security;

import com.esukan.model.User;
import com.esukan.model.UserRole;
import com.esukan.util.DBConnection;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

public final class JwtHelper {

    private JwtHelper() {}

    private static SecretKey key() {
        String secret = firstNonBlank(
                System.getenv("ESUKAN_JWT_SECRET"),
                System.getProperty("esukan.jwt.secret"),
                DBConnection.getAppProperties().getProperty("esukan.jwt.secret"));
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("JWT secret must be at least 32 bytes for HS256");
        }
        return Keys.hmacShaKeyFor(bytes);
    }

    private static long expirationMs() {
        String s = firstNonBlank(
                System.getenv("ESUKAN_JWT_EXPIRATION_MS"),
                System.getProperty("esukan.jwt.expiration-ms"),
                DBConnection.getAppProperties().getProperty("esukan.jwt.expiration-ms", "86400000"));
        return Long.parseLong(s.trim());
    }

    public static String generateToken(UserPrincipal principal) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + expirationMs());
        return Jwts.builder()
                .subject(principal.getUsername())
                .claim("uid", principal.getId())
                .claim("role", principal.getRole().name())
                .issuedAt(now)
                .expiration(exp)
                .signWith(key())
                .compact();
    }

    public static UserPrincipal parseBearer(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return null;
        }
        String token = authorizationHeader.substring(7).trim();
        if (token.isEmpty()) {
            return null;
        }
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            Long uid = claims.get("uid", Number.class).longValue();
            String roleStr = claims.get("role", String.class);
            UserRole role = UserRole.valueOf(roleStr);
            return new UserPrincipal(
                    uid,
                    claims.getSubject(),
                    null,
                    true,
                    role,
                    null,
                    null,
                    null
            );
        } catch (Exception e) {
            return null;
        }
    }

    /** Load full principal fields from DB after JWT claims. */
    public static UserPrincipal enrich(UserPrincipal partial, User u) {
        return new UserPrincipal(
                u.getId(),
                u.getUsername(),
                u.getPasswordHash(),
                u.isEnabled(),
                u.getRole(),
                u.getStudentIdNumber(),
                u.getEmail(),
                u.getFullName()
        );
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v;
            }
        }
        return "";
    }
}
