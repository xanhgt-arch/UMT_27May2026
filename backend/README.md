# UMT Backend

ASP.NET Web API backend for the UMT dashboard.

Target framework: .NET Framework 4.6.2.

## Run

Host this folder as an ASP.NET application in IIS and bind the site to port
7000. The app reads database settings from `.env` in the application root.

Required settings:

```text
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-password
DB_NAME=usagemonitoringtool
```

Endpoints:

```text
GET /api/export/mst-usage-tool
GET /api/export/raw-sessions-json
```
