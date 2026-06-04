using MySqlConnector;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Web;
using System.Web.Http;
using UMT.Backend.Services;
using System.Web.Http.Cors;

namespace UMT.Backend.Controllers
{
    [RoutePrefix("api/export")]
    public class ExportController : ApiController
    {
        private readonly MySqlConnectionFactory _connectionFactory;
        private readonly RawSessionsService _service;

        public ExportController()
        {
            _connectionFactory = new MySqlConnectionFactory();
            _service = new RawSessionsService(_connectionFactory);
        }

        private static readonly Dictionary<string, string> ApplicationExportTables =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "3d-trim", "mst_3dtrim_data" },
                { "multiple-3d-operations", "mst_multi3d_details" },
                { "naming-tool", "mst_namingtool_data" },
                { "point-chart", "mst_pointchart_data" },
                { "profile-checker", "mst_profilechecker_data" },
                { "smart-cvt", "mst_smartcvt_data" },
                { "section-manager", "mst_sectionmanager_data" }
            };

        // ================= CSV =================
        [HttpGet]
        [Route("mst-usage-tool")]
        public async Task<HttpResponseMessage> ExportMstUsageTool()
        {
            try
            {
                var table = await _connectionFactory.QueryTableAsync(
                    "SELECT * FROM " + _connectionFactory.TableName("mst_tool_usage"));

                if (table.Rows.Count == 0)
                {
                    return Request.CreateResponse(HttpStatusCode.NotFound,
                        new { message = "No data found" });
                }

                var csv = CsvWriter.Write(table.Columns, table.Rows);

                var result = new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(csv, Encoding.UTF8, "text/csv")
                };

                result.Content.Headers.ContentDisposition =
                    new System.Net.Http.Headers.ContentDispositionHeaderValue("attachment")
                    {
                        FileName = "mst_usage_tool.csv"
                    };

                return result;
            }
            catch (Exception ex)
            {
                return Request.CreateResponse(HttpStatusCode.InternalServerError,
                    new { message = ex.Message });
            }
        }

        [HttpGet]
        [Route("application-data/{applicationKey}")]
        public async Task<HttpResponseMessage> ExportApplicationData(string applicationKey)
        {
            try
            {
                if (!IsCurrentUserAdmin())
                {
                    return Request.CreateResponse(HttpStatusCode.Forbidden,
                        new { message = "Administrator access is required." });
                }

                string table;
                if (string.IsNullOrWhiteSpace(applicationKey) ||
                    !ApplicationExportTables.TryGetValue(applicationKey.Trim(), out table))
                {
                    return Request.CreateResponse(HttpStatusCode.BadRequest,
                        new { message = "Unknown application export." });
                }

                var query = Request.GetQueryNameValuePairs()
                    .GroupBy(kv => kv.Key, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(
                        g => g.Key,
                        g => g.Select(x => x.Value).Where(v => !string.IsNullOrWhiteSpace(v)).ToList(),
                        StringComparer.OrdinalIgnoreCase);

                var sql = new StringBuilder();
                sql.Append("SELECT * FROM ");
                sql.Append(_connectionFactory.TableName(table));
                sql.Append(" WHERE 1 = 1");

                var parameters = new List<MySqlParameter>();
                ApplyDateFilter(sql, parameters, query);
                ApplyMultiValueFilter(sql, parameters, query, "cad", "CadTool", "cad");
                ApplyHardwareFilter(sql, parameters, query);
                sql.Append(" ORDER BY StartTime DESC");

                var resultTable = await QueryTableAsync(sql.ToString(), parameters);

                if (resultTable.Rows.Count == 0)
                {
                    return Request.CreateResponse(HttpStatusCode.NotFound,
                        new { message = "No data found for the selected filters." });
                }

                var csv = CsvWriter.Write(resultTable.Columns, resultTable.Rows);
                var result = new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(csv, Encoding.UTF8, "text/csv")
                };

                result.Content.Headers.ContentDisposition =
                    new System.Net.Http.Headers.ContentDispositionHeaderValue("attachment")
                    {
                        FileName = table + ".csv"
                    };

                return result;
            }
            catch (Exception ex)
            {
                return Request.CreateResponse(HttpStatusCode.InternalServerError,
                    new { message = ex.Message });
            }
        }

        // ================= RAW JSON DOWNLOAD =================
        [HttpGet]
        [Route("raw-sessions-json")]
        public async Task<HttpResponseMessage> DownloadRawSessionsJson()
        {
            try
            {
                
                await _service.GenerateJson();

                // File path (same as service)
                
                string basePath = Environment.GetEnvironmentVariable("DASHBOARD_STATIC_DIR");

                if (string.IsNullOrEmpty(basePath))
                    basePath = AppDomain.CurrentDomain.BaseDirectory;

                string filePath = Path.Combine(basePath, "raw-sessions.json");

                if (!File.Exists(filePath))
                {
                    return Request.CreateResponse(HttpStatusCode.NotFound,
                        new { message = "File not found" });
                }

                var bytes = File.ReadAllBytes(filePath);

                var result = new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new ByteArrayContent(bytes)
                };

                result.Content.Headers.ContentType =
                    new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");

                result.Content.Headers.ContentDisposition =
                    new System.Net.Http.Headers.ContentDispositionHeaderValue("attachment")
                    {
                        FileName = "raw-sessions.json"
                    };

                return result;
            }
            catch (Exception ex)
            {
                return Request.CreateResponse(HttpStatusCode.InternalServerError,
                    new { message = ex.Message });
            }
        }

        // ================= OPTIONAL: DOWNLOAD OTHER FILES =================

        [HttpGet]
        [Route("raw-sessions-compact")]
        public async Task<HttpResponseMessage> DownloadCompactJson()
        {
            return await DownloadFile("raw-sessions-compact.json");
        }

        [HttpGet]
        [Route("vdi-json")]
        public async Task<HttpResponseMessage> DownloadVdiJson()
        {
            return await DownloadFile("vdi.json");
        }

        [HttpGet]
        [Route("domains-json")]
        public async Task<HttpResponseMessage> DownloadDomainsJson()
        {
            return await DownloadFile("domains.json");
        }

   
        private async Task<HttpResponseMessage> DownloadFile(string fileName)
        {
            try
            {
                await _service.GenerateJson();

                string basePath = Environment.GetEnvironmentVariable("DASHBOARD_STATIC_DIR");

                if (string.IsNullOrEmpty(basePath))
                    basePath = AppDomain.CurrentDomain.BaseDirectory;

                string filePath = Path.Combine(basePath, fileName);

                if (!File.Exists(filePath))
                {
                    return Request.CreateResponse(HttpStatusCode.NotFound,
                        new { message = "File not found" });
                }

                var bytes = File.ReadAllBytes(filePath);

                var result = new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new ByteArrayContent(bytes)
                };

                result.Content.Headers.ContentType =
                    new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");

                result.Content.Headers.ContentDisposition =
                    new System.Net.Http.Headers.ContentDispositionHeaderValue("attachment")
                    {
                        FileName = fileName
                    };

                return result;
                }
            
                catch (Exception ex) 
                    {
                        return Request.CreateResponse(HttpStatusCode.InternalServerError,
                            new { message = ex.ToString() });
                    }
        }

        private async Task<QueryTable> QueryTableAsync(string sql, List<MySqlParameter> parameters)
        {
            var columns = new List<string>();
            var rows = new List<Dictionary<string, object>>();

            using (var connection = _connectionFactory.CreateConnection())
            {
                await connection.OpenAsync();

                using (var command = new MySqlCommand(sql, connection))
                {
                    foreach (var parameter in parameters)
                    {
                        command.Parameters.Add(parameter);
                    }

                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        for (int i = 0; i < reader.FieldCount; i++)
                        {
                            columns.Add(reader.GetName(i));
                        }

                        while (await reader.ReadAsync())
                        {
                            var row = new Dictionary<string, object>();
                            foreach (var column in columns)
                            {
                                var value = reader[column];
                                row[column] = value == DBNull.Value ? null : value;
                            }

                            rows.Add(row);
                        }
                    }
                }
            }

            return new QueryTable(columns, rows);
        }

        private static void ApplyDateFilter(
            StringBuilder sql,
            List<MySqlParameter> parameters,
            Dictionary<string, List<string>> query)
        {
            var range = GetFirst(query, "range");
            if (string.IsNullOrWhiteSpace(range))
            {
                range = "thisYear";
            }

            DateTime from;
            DateTime to;
            if (!TryResolveRange(range, GetFirst(query, "customFrom"), GetFirst(query, "customTo"), out from, out to))
            {
                return;
            }

            sql.Append(" AND StartTime >= @FromDate AND StartTime <= @ToDate");
            parameters.Add(new MySqlParameter("@FromDate", from));
            parameters.Add(new MySqlParameter("@ToDate", to));
        }

        private static bool TryResolveRange(string range, string customFrom, string customTo, out DateTime from, out DateTime to)
        {
            var now = DateTime.Now;
            from = DateTime.MinValue;
            to = DateTime.MaxValue;

            switch ((range ?? "").Trim())
            {
                case "all":
                    return false;
                case "currentMonth":
                    from = new DateTime(now.Year, now.Month, 1);
                    to = now;
                    return true;
                case "lastMonth":
                    var lastMonth = new DateTime(now.Year, now.Month, 1).AddMonths(-1);
                    from = lastMonth;
                    to = lastMonth.AddMonths(1).AddTicks(-1);
                    return true;
                case "thisYear":
                    from = new DateTime(now.Year, 1, 1);
                    to = now;
                    return true;
                case "lastYear":
                    from = new DateTime(now.Year - 1, 1, 1);
                    to = new DateTime(now.Year - 1, 12, 31, 23, 59, 59, 999);
                    return true;
                case "custom":
                    DateTime parsedFrom;
                    DateTime parsedTo;
                    if (DateTime.TryParseExact(customFrom, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out parsedFrom) &&
                        DateTime.TryParseExact(customTo, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out parsedTo))
                    {
                        from = parsedFrom.Date;
                        to = parsedTo.Date.AddDays(1).AddTicks(-1);
                        return true;
                    }
                    return false;
                default:
                    from = new DateTime(now.Year, 1, 1);
                    to = now;
                    return true;
            }
        }

        private static void ApplyMultiValueFilter(
            StringBuilder sql,
            List<MySqlParameter> parameters,
            Dictionary<string, List<string>> query,
            string queryKey,
            string columnName,
            string parameterPrefix)
        {
            List<string> values;
            if (!query.TryGetValue(queryKey, out values) || values.Count == 0)
            {
                return;
            }

            var parameterNames = new List<string>();
            for (int i = 0; i < values.Count; i++)
            {
                var name = "@" + parameterPrefix + i.ToString(CultureInfo.InvariantCulture);
                parameterNames.Add(name);
                parameters.Add(new MySqlParameter(name, values[i].Trim()));
            }

            sql.Append(" AND ");
            sql.Append(columnName);
            sql.Append(" IN (");
            sql.Append(string.Join(",", parameterNames));
            sql.Append(")");
        }

        private static void ApplyHardwareFilter(
            StringBuilder sql,
            List<MySqlParameter> parameters,
            Dictionary<string, List<string>> query)
        {
            List<string> values;
            if (!query.TryGetValue("hardware", out values) || values.Count == 0)
            {
                return;
            }

            var normalized = values
                .Select(v => string.Equals(v, "VDI", StringComparison.OrdinalIgnoreCase) ? "1" :
                    string.Equals(v, "Non-VDI", StringComparison.OrdinalIgnoreCase) ? "0" : null)
                .Where(v => v != null)
                .Distinct()
                .ToList();

            if (normalized.Count == 0)
            {
                return;
            }

            var parameterNames = new List<string>();
            for (int i = 0; i < normalized.Count; i++)
            {
                var name = "@hardware" + i.ToString(CultureInfo.InvariantCulture);
                parameterNames.Add(name);
                parameters.Add(new MySqlParameter(name, normalized[i]));
            }

            sql.Append(" AND CAST(IsVDI AS CHAR) IN (");
            sql.Append(string.Join(",", parameterNames));
            sql.Append(")");
        }

        private bool IsCurrentUserAdmin()
        {
            var userId = ExtractUserId(GetIdentityName());
            if (string.IsNullOrWhiteSpace(userId))
            {
                return false;
            }

            using (var conn = _connectionFactory.CreateConnection())
            {
                conn.Open();
                string sql =
                    "SELECT COUNT(1) FROM " + _connectionFactory.TableName("mst_cooper_admins") +
                    " WHERE LOWER(UserId) = LOWER(@UserId)";

                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@UserId", userId.Trim());
                    return Convert.ToInt32(cmd.ExecuteScalar()) > 0;
                }
            }
        }

        private string GetIdentityName()
        {
            if (User != null &&
                User.Identity != null &&
                !string.IsNullOrWhiteSpace(User.Identity.Name))
            {
                return User.Identity.Name;
            }

            if (HttpContext.Current != null &&
                HttpContext.Current.User != null &&
                HttpContext.Current.User.Identity != null &&
                !string.IsNullOrWhiteSpace(HttpContext.Current.User.Identity.Name))
            {
                return HttpContext.Current.User.Identity.Name;
            }

            return "";
        }

        private static string ExtractUserId(string identityName)
        {
            if (string.IsNullOrWhiteSpace(identityName))
            {
                return "";
            }

            identityName = identityName.Trim();
            int index = identityName.LastIndexOf('\\');
            if (index < 0)
            {
                index = identityName.LastIndexOf('/');
            }

            if (index >= 0 && index < identityName.Length - 1)
            {
                return identityName.Substring(index + 1).Trim();
            }

            return identityName;
        }

        private static string GetFirst(Dictionary<string, List<string>> query, string key)
        {
            List<string> values;
            return query.TryGetValue(key, out values) && values.Count > 0 ? values[0] : null;
        }
    }
}
