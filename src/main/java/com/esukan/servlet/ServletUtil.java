package com.esukan.servlet;

import com.esukan.security.JwtHelper;
import com.esukan.security.UserPrincipal;
import com.esukan.util.Jsons;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.stream.Stream;

public final class ServletUtil {

    private ServletUtil() {}

    public static String[] pathSegments(HttpServletRequest req) {
        String pi = req.getPathInfo();
        if (pi == null || pi.isBlank() || "/".equals(pi)) {
            return new String[0];
        }
        return Stream.of(pi.substring(1).split("/")).filter(s -> !s.isEmpty()).toArray(String[]::new);
    }

    public static String readBody(HttpServletRequest req) throws IOException {
        return new String(req.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    }

    public static void writeJson(HttpServletResponse resp, int status, Object body) throws IOException {
        resp.setStatus(status);
        resp.setContentType("application/json");
        if (body instanceof String s) {
            resp.getWriter().write(s);
        } else {
            resp.getWriter().write(Jsons.gson().toJson(body));
        }
    }

    public static UserPrincipal optionalAuth(HttpServletRequest req) {
        return JwtHelper.parseBearer(req.getHeader("Authorization"));
    }

    public static UserPrincipal requireAuth(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        UserPrincipal p = optionalAuth(req);
        if (p == null) {
            writeJson(resp, HttpServletResponse.SC_UNAUTHORIZED, java.util.Map.of("error", "Unauthorized"));
            return null;
        }
        return p;
    }

    /** Parses IDs from JSON object maps (Gson may use {@link Double} for whole numbers). */
    public static long parseLongValue(Object value) {
        if (value == null) {
            throw new IllegalArgumentException("missing value");
        }
        if (value instanceof Number n) {
            return n.longValue();
        }
        String s = value.toString().trim();
        if (s.contains(".")) {
            return (long) Double.parseDouble(s);
        }
        return Long.parseLong(s);
    }

    public static int parseIntValue(Object value) {
        if (value == null) {
            throw new IllegalArgumentException("missing value");
        }
        if (value instanceof Number n) {
            return n.intValue();
        }
        String s = value.toString().trim();
        if (s.contains(".")) {
            return (int) Double.parseDouble(s);
        }
        return Integer.parseInt(s);
    }
}
