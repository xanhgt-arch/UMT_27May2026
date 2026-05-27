using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.Caching;
using System.Threading.Tasks;
using MySqlConnector;
using Newtonsoft.Json;
using UMT.Backend.Models;

namespace UMT.Backend.Services
{
    public class RawSessionsService
    {
        private readonly MySqlConnectionFactory _factory;
        private static readonly MemoryCache cache = MemoryCache.Default;

        public RawSessionsService(MySqlConnectionFactory factory)
        {
            _factory = factory;
        }

        public async Task GenerateJson()
        {
            if (cache.Contains("sessions"))
                return;

            var rows = LoadData();

            // ✅ RAW JSON (your original format)
            var rawJson = rows;

            // ✅ COMPACT JSON with required format
            var compact = rows
                .Select((r, i) => ToCompactRowV2(r, i + 1))
                .ToList();

                
            var compactRows = compact.Cast<object[]>().ToList();
            var vdi = BuildVdiUsers(compactRows);
            var domains = BuildDomains(compactRows);


            // ✅ Read env path
            string basePath = Environment.GetEnvironmentVariable("DASHBOARD_STATIC_DIR");

            if (string.IsNullOrEmpty(basePath))
                basePath = AppDomain.CurrentDomain.BaseDirectory;

            if (!Directory.Exists(basePath))
                Directory.CreateDirectory(basePath);

            // ✅ Write files
            await Task.WhenAll(
                WriteJsonAsync(Path.Combine(basePath, "raw-sessions.json"), rawJson),
                WriteJsonAsync(Path.Combine(basePath, "raw-sessions-compact.json"), compact),
                WriteJsonAsync(Path.Combine(basePath, "vdi.json"), vdi),
                WriteJsonAsync(Path.Combine(basePath, "domains.json"), domains)
            );

            cache.Set("sessions", true, DateTimeOffset.Now.AddMinutes(5));
        }


        private List<RawUsageRow> LoadData()
        {
            var rows = new List<RawUsageRow>();

            using (var conn = _factory.CreateConnection())
            {
                conn.Open();

                string sql = "SELECT * FROM " + _factory.TableName("mst_tool_usage") + " ORDER BY StartTime DESC";

                using (var cmd = new MySqlCommand(sql, conn))
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        rows.Add(RawUsageRow.FromReader(reader));
                    }
                }
            }

            return rows;
        }

        private object[] ToCompactRow(RawUsageRow row, int index)
        {
            var start = Convert.ToDateTime(row.StartTime);

            return new object[]
            {
                "sess-" + (index + 1),
                row.SrNo,
                row.ApplicationName,
                row.Functionality,
                row.CadTool,
                row.UserID,
                row.MachineID,
                row.Domain,
                row.Region,
                row.ProductLine,
                start.ToString("yyyy-MM-dd HH:mm:ss"),
                start.Year,
                start.Month - 1,
                row.IsVDI != null && row.IsVDI.ToString() == "1" ? "VDI" : "Non-VDI"
            };
        }

        private List<object> BuildVdiUsers(List<object[]> rows)
        {
            return rows
                .Where(r => Convert.ToString(r[13]) == "VDI")
                .GroupBy(r => Convert.ToString(r[5]).ToLower())
                .Where(g => !string.IsNullOrWhiteSpace(g.Key))
                .Select(g => g.First())
                .Select((row, i) => new
                {
                    id = "vdi-" + (i + 1),
                    user = row[5],
                    domain = row[7]
                })
                .Cast<object>()
                .ToList();
        }

        private List<object> BuildDomains(List<object[]> rows)
        {
            return rows
                .GroupBy(r => Convert.ToString(r[7]))
                .Where(g => !string.IsNullOrWhiteSpace(g.Key))
                .Select((g, i) => new
                {
                    id = "dom-" + (i + 1),
                    domain = g.Key,
                    users = g.Select(x => x[5]).Distinct().Count(),
                    active = g.Count() > 0
                })
                .Cast<object>()
                .ToList();
        }

        private async Task WriteJsonAsync<T>(string fullPath, T data)
        {
            var temp = fullPath + ".tmp";

            var json = JsonConvert.SerializeObject(data);

            File.WriteAllText(temp, json);

            if (File.Exists(fullPath))
                File.Delete(fullPath);

            File.Move(temp, fullPath);

            await Task.CompletedTask;
        }

        private object[] ToCompactRowV2(RawUsageRow row, int index)
        {
            DateTime start;
            DateTime stop;

            // ✅ Safe parsing
            bool validStart = DateTime.TryParse(row.StartTime?.ToString(), out start) && start > DateTime.MinValue;
            bool validStop = DateTime.TryParse(row.StopTime?.ToString(), out stop) && stop > DateTime.MinValue;

            if (!validStart) start = DateTime.MinValue;
            if (!validStop) stop = start;

            // ✅ Epoch (safe)
            long startMs = validStart ? new DateTimeOffset(start).ToUnixTimeMilliseconds() : 0;
            long? stopMs = validStop ? new DateTimeOffset(stop).ToUnixTimeMilliseconds() : (long?)null;

            return new object[]
            {
                "sess-" + index.ToString("D4"),                  // 0 id ✅
                row.SrNo,                                        // 1
                row.ApplicationName,                             // 2
                row.Functionality,                               // 3
                row.CadTool,                                     // 4
                row.UserID,                                      // 5
                row.MachineID,                                   // 6
                row.Domain,                                      // 7
                row.Region,                                      // 8
                row.ProductLine,                                 // 9

                validStart ? start.ToString("yyyy-MM-dd HH:mm:ss.fff") : null,   // 10
                validStop ? stop.ToString("yyyy-MM-dd HH:mm:ss.fff") : null,     // 11

                startMs,                                         // 12
                stopMs,                                          // 13

                validStart ? start.Year : 0,                     // 14
                validStart ? start.Month - 1 : 0,                // 15 ✅ 0-based
                validStart ? start.Day : 0,                      // 16 ✅ IMPORTANT (you missed earlier)

                validStart ? start.ToString("yyyy-MM") : null,   // 17
                validStart ? start.ToString("MMM ''yy") : null,  // 18 ✅ EXACT FORMAT (Jan '19)

                row.Status,                                     // 19

                row.IsVDI != null && row.IsVDI.ToString() == "1"
                    ? "VDI"
                    : "Non-VDI",                                // 20 ✅ matches frontend type

                row.IsProd != null && row.IsProd.ToString() == "1"  // 21 ✅ BOOLEAN (VERY IMPORTANT)
            };
        }
    }
}
