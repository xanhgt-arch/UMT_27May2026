using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
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
    }
}