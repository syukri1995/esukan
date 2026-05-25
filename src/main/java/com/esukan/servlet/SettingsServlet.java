package com.esukan.servlet;

import com.esukan.model.UserRole;
import com.esukan.security.UserPrincipal;
import com.esukan.util.DBConnection;
import com.google.gson.reflect.TypeToken;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.lang.reflect.Type;
import java.sql.Connection;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.Map;

public class SettingsServlet extends BaseHttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        UserPrincipal auth = ServletUtil.requireAuth(req, resp);
        if (auth == null) {
            return;
        }
        String[] segs = ServletUtil.pathSegments(req);
        if (segs.length != 1 || !"operating-hours".equals(segs[0])) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of("error", "Not found"));
            return;
        }
        try (Connection conn = DBConnection.getConnection()) {
            Map<String, String> out = new HashMap<>();
            out.put("defaultOpenTime", OperatingHoursHelper.getSettingTime(conn, "default_open_time", LocalTime.of(8, 0)).toString());
            out.put("defaultCloseTime", OperatingHoursHelper.getSettingTime(conn, "default_close_time", LocalTime.of(22, 0)).toString());
            ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, out);
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
        }
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        UserPrincipal auth = ServletUtil.requireAuth(req, resp);
        if (auth == null || auth.getRole() != UserRole.ADMIN) {
            if (auth != null) {
                ServletUtil.writeJson(resp, HttpServletResponse.SC_FORBIDDEN, Map.of("error", "Forbidden"));
            }
            return;
        }
        String[] segs = ServletUtil.pathSegments(req);
        if (segs.length != 1 || !"operating-hours".equals(segs[0])) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_NOT_FOUND, Map.of("error", "Not found"));
            return;
        }
        Type mapType = new TypeToken<Map<String, Object>>() {}.getType();
        Map<String, Object> body = com.esukan.util.Jsons.gson().fromJson(ServletUtil.readBody(req), mapType);
        try (Connection conn = DBConnection.getConnection()) {
            LocalTime open = OperatingHoursHelper.parseTime(String.valueOf(body.get("defaultOpenTime")));
            LocalTime close = OperatingHoursHelper.parseTime(String.valueOf(body.get("defaultCloseTime")));
            if (open == null || close == null || !open.isBefore(close)) {
                throw new RuntimeException("Invalid operating hours");
            }
            OperatingHoursHelper.setSetting(conn, "default_open_time", open.toString().substring(0, 5));
            OperatingHoursHelper.setSetting(conn, "default_close_time", close.toString().substring(0, 5));
            Map<String, String> out = new HashMap<>();
            out.put("defaultOpenTime", open.toString());
            out.put("defaultCloseTime", close.toString());
            ServletUtil.writeJson(resp, HttpServletResponse.SC_OK, out);
        } catch (Exception e) {
            ServletUtil.writeJson(resp, HttpServletResponse.SC_BAD_REQUEST, Map.of("error", e.getMessage()));
        }
    }
}
