# E-Sukan Project Glossary

## Payment & Verification Terms

### Payment Reference ID
A universally unique identifier (UUIDv4) generated automatically when a new payment transaction is created. Used as a secure, unguessable key for verifying transactions and generating public official receipts.

### Legacy Transaction Reference
A sequential reference code used in older versions of E-Sukan, formatted as `ESP-YYYYMMDD-XXXXX` (where `XXXXX` is the 5-digit zero-padded payment ID).

### Payment Gateway
A subsystem that securely routes payment requests to banks or digital wallet providers. In the local development environment, E-Sukan uses a mock gateway that simulates card, online banking, and e-wallet transactions.

### Verification QR Code
A QR code printed on the official payment receipt. Scanning the QR code points to `verify.html?ref=<reference_id>`, allowing administrators or staff to quickly authenticate a student's payment status using their mobile device.

### In-Memory Database (H2)
A lightweight Java SQL database that runs entirely in memory. Used for rapid local development. Schema and seed data are created automatically on startup.

### Servlet 6 / Jakarta EE 10
The runtime specification used to build the E-Sukan backend. Handles HTTP requests (e.g., `PaymentServlet`, `PaymentVerificationServlet`) and filters.
