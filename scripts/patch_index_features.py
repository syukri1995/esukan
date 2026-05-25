from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src/main/resources/static/index.html"
c = p.read_text(encoding="utf-8")

if "features-ui.css" not in c:
    c = c.replace(
        '<link rel="stylesheet" href="/css/payment-gateway.css">',
        '<link rel="stylesheet" href="/css/payment-gateway.css">\n    <link rel="stylesheet" href="/css/features-ui.css">',
    )

if "features-ui.js" not in c:
    c = c.replace(
        '<script src="/js/payment-gateway.js"></script>',
        '<script src="/js/payment-gateway.js"></script>\n<script src="/js/features-ui.js"></script>',
    )

c = c.replace(
    '<section class="page" id="page-facilities">\n        <div class="page-toolbar">',
    '<section class="page" id="page-facilities">\n        <div class="page-toolbar" id="facilitiesPageToolbar">',
)

c = c.replace(
    "<th>Quantity</th>\n                            <th>Last Updated</th>",
    "<th>Quantity</th>\n                            <th>Cost/hr</th>\n                            <th>Last Updated</th>",
)

c = c.replace(
    '<tr><td colspan="7" class="loading-msg">Loading...</td></tr>\n                    </tbody>\n                </table>\n            </div>\n        </div>\n    </section>\n\n    <!-- RENTALS PAGE -->',
    '<tr><td colspan="8" class="loading-msg">Loading...</td></tr>\n                    </tbody>\n                </table>\n            </div>\n        </div>\n    </section>\n\n    <!-- RENTALS PAGE -->',
)

modals = """
<!-- FACILITY EDITOR MODAL -->
<div class="modal" id="facilityModal">
    <div class="modal-header">
        <h2 class="modal-title" id="facilityModalTitle">Add facility</h2>
        <button class="modal-close" onclick="closeModal()">&#10005;</button>
    </div>
    <form id="facilityForm">
        <input type="hidden" id="fId">
        <div class="form-group"><label>Name</label><input type="text" id="fName" required></div>
        <div class="form-row">
            <div class="form-group"><label>Type</label>
                <select id="fType"><option value="BADMINTON">Badminton</option><option value="FUTSAL">Futsal</option></select>
            </div>
            <div class="form-group"><label>Cost per hour (RM)</label><input type="number" id="fCostPerHour" min="0" step="0.01" value="0"></div>
        </div>
        <div class="form-group"><label>Description</label><input type="text" id="fDesc"></div>
        <div class="form-row">
            <div class="form-group"><label>Open time override</label><input type="time" id="fOpenTime" placeholder="Campus default"></div>
            <div class="form-group"><label>Close time override</label><input type="time" id="fCloseTime" placeholder="Campus default"></div>
        </div>
        <p class="form-hint">Leave hours empty to use campus default operating hours.</p>
        <div class="form-group"><label><input type="checkbox" id="fActive" checked> Active</label></div>
        <div class="form-group"><label>Equipment at this facility</label><div id="fEquipmentList" class="equipment-checklist"></div></div>
        <div class="form-error" id="facilityError"></div>
        <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn-primary">Save</button>
        </div>
    </form>
</div>

<!-- CAMPUS HOURS MODAL -->
<div class="modal modal-sm" id="campusHoursModal">
    <div class="modal-header">
        <h2 class="modal-title">Campus operating hours</h2>
        <button class="modal-close" onclick="closeModal()">&#10005;</button>
    </div>
    <form id="campusHoursForm">
        <div class="form-row">
            <div class="form-group"><label>Default open</label><input type="time" id="campusOpen" value="08:00" required></div>
            <div class="form-group"><label>Default close</label><input type="time" id="campusClose" value="22:00" required></div>
        </div>
        <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn-primary">Save</button>
        </div>
    </form>
</div>

<!-- EQUIPMENT EDITOR MODAL -->
<div class="modal" id="equipmentModal">
    <div class="modal-header">
        <h2 class="modal-title" id="equipmentModalTitle">Add equipment</h2>
        <button class="modal-close" onclick="closeModal()">&#10005;</button>
    </div>
    <form id="equipmentForm">
        <input type="hidden" id="eqId">
        <div class="form-group"><label>Name</label><input type="text" id="eqName" required></div>
        <div class="form-row">
            <div class="form-group"><label>Category</label><input type="text" id="eqCategory" required></div>
            <div class="form-group"><label>Quantity</label><input type="number" id="eqQty" min="1" value="1" required></div>
        </div>
        <div class="form-group"><label>Cost per hour (RM)</label><input type="number" id="eqCostPerHour" min="0" step="0.01" value="0"></div>
        <div class="form-group"><label>Description</label><input type="text" id="eqDesc"></div>
        <div class="form-error" id="equipmentError"></div>
        <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn-primary">Save</button>
        </div>
    </form>
</div>

<!-- TOURNAMENT DETAIL MODAL -->
<div class="modal modal-wide" id="tournamentDetailModal" style="width:720px;max-width:95vw">
    <div class="modal-header">
        <h2 class="modal-title" id="tournamentDetailTitle">Tournament</h2>
        <button class="modal-close" onclick="closeModal()">&#10005;</button>
    </div>
    <div class="tournament-detail-tabs">
        <button type="button" class="tournament-tab active" data-tab="details" onclick="showTournamentTab('details')">Details</button>
        <button type="button" class="tournament-tab" data-tab="teams" onclick="showTournamentTab('teams')">Teams</button>
        <button type="button" class="tournament-tab" data-tab="bracket" onclick="showTournamentTab('bracket')">Bracket</button>
    </div>
    <div class="tournament-panel active" id="tournamentPanelDetails">
        <div class="form-group"><label>Title</label><input type="text" id="tdTitle"></div>
        <div class="form-group"><label>Description</label><textarea id="tdDesc" rows="2"></textarea></div>
        <div class="form-row">
            <div class="form-group"><label>Start</label><input type="date" id="tdStart"></div>
            <div class="form-group"><label>End</label><input type="date" id="tdEnd"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Format</label>
                <select id="tdFormat"><option value="SINGLE_ELIMINATION">Single elimination</option><option value="ROUND_ROBIN">Round robin</option></select>
            </div>
            <div class="form-group"><label>Status</label>
                <select id="tdStatus"><option value="DRAFT">DRAFT</option><option value="OPEN">OPEN</option><option value="CLOSED">CLOSED</option><option value="COMPLETED">COMPLETED</option></select>
            </div>
        </div>
        <div class="form-group"><label>Venue</label><select id="tdVenue"></select></div>
        <button type="button" class="btn-primary" id="tournamentDetailSaveBtn">Save details</button>
    </div>
    <div class="tournament-panel" id="tournamentPanelTeams">
        <table class="table"><thead><tr><th>Team</th><th>Email</th><th>Registered by</th></tr></thead>
        <tbody id="tournamentTeamsBody"><tr><td colspan="3" class="loading-msg">Loading...</td></tr></tbody></table>
    </div>
    <div class="tournament-panel" id="tournamentPanelBracket">
        <button type="button" class="btn-primary" id="bracketGenerateBtn" onclick="generateTournamentBracket()" style="margin-bottom:12px">Generate bracket</button>
        <div id="bracketContainer"><div class="loading-msg">Load bracket tab to view</div></div>
    </div>
</div>

"""

if "facilityModal" not in c:
    c = c.replace("<!-- TOAST NOTIFICATION -->", modals + "\n<!-- TOAST NOTIFICATION -->")

p.write_text(c, encoding="utf-8")
print("index.html patched")
