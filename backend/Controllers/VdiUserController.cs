using MySqlConnector;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Web;
using System.Web.Http;
using UMT.Backend.Services;

namespace UMT.Backend.Controllers
{
    [RoutePrefix("api/vdi")]
    public class VdiController : ApiController
    {
        private readonly MySqlConnectionFactory _factory = new MySqlConnectionFactory();

        // ==========================================================
        // Get Windows Identity safely
        // Example: DOMAIN\haardik or DOMAIN/haardik
        // ==========================================================
        private string GetIdentityName()
        {
            string identityName = "";

            if (User != null &&
                User.Identity != null &&
                !string.IsNullOrWhiteSpace(User.Identity.Name))
            {
                identityName = User.Identity.Name;
            }

            if (string.IsNullOrWhiteSpace(identityName) &&
                HttpContext.Current != null &&
                HttpContext.Current.User != null &&
                HttpContext.Current.User.Identity != null)
            {
                identityName = HttpContext.Current.User.Identity.Name;
            }

            return identityName ?? "";
        }

        // ==========================================================
        // Extract only UserId from DOMAIN\UserId or DOMAIN/UserId
        // ==========================================================
        private string ExtractUserId(string identityName)
        {
            if (string.IsNullOrWhiteSpace(identityName))
                return "";

            identityName = identityName.Trim();

            return identityName
                .Split(new char[] { '\\', '/' })
                .LastOrDefault();
        }

        // ==========================================================
        // Current logged-in user id only
        // Used for CreatedBy / ModifiedBy
        // ==========================================================
        private string GetCurrentUser()
        {
            string identityName = GetIdentityName();
            string userId = ExtractUserId(identityName);

            if (string.IsNullOrWhiteSpace(userId))
                return "UNKNOWN";

            return userId;
        }

        // ==========================================================
        // Check if current user exists in mst_cooper_admins
        // ==========================================================
        private bool IsCurrentUserAdmin()
        {
            string currentUserId = GetCurrentUser();

            if (string.IsNullOrWhiteSpace(currentUserId) ||
                currentUserId.Equals("UNKNOWN", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            using (var conn = _factory.CreateConnection())
            {
                conn.Open();

                string adminTable = _factory.TableName("mst_cooper_admins");

                string sql = @"
                    SELECT COUNT(*)
                    FROM " + adminTable + @"
                    WHERE LOWER(UserId) = LOWER(@UserId)
                ";

                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@UserId", currentUserId);

                    int count = Convert.ToInt32(cmd.ExecuteScalar());

                    return count > 0;
                }
            }
        }

        // ==========================================================
        // Common forbidden response
        // ==========================================================
        private IHttpActionResult ForbiddenAdminOnly()
        {
            return Ok(new List<object>());
        }

        // ✅ GET ALL VDI USERS
        [HttpGet]
        [Route("")]
        public IHttpActionResult GetAll()
        {
            try
            {
                if (!IsCurrentUserAdmin())
                {
                    return ForbiddenAdminOnly();
                }

                var list = new List<object>();

                using (var conn = _factory.CreateConnection())
                {
                    conn.Open();

                    string sql = "SELECT * FROM " + _factory.TableName("mst_vdi_user_detail");

                    using (var cmd = new MySqlCommand(sql, conn))
                    using (var reader = cmd.ExecuteReader())
                    {
                        int index = 1;

                        while (reader.Read())
                        {
                            var userId = Convert.ToString(reader["UserId"]);
                            var domain = Convert.ToString(reader["Domain"]);
                            var region = Convert.ToString(reader["Region"]);

                            var createdDate = reader["CreatedDate"] != DBNull.Value
                                ? Convert.ToDateTime(reader["CreatedDate"]).ToString("o")
                                : null;

                            var modifiedDate = reader["ModifiedDate"] != DBNull.Value
                                ? Convert.ToDateTime(reader["ModifiedDate"]).ToString("o")
                                : null;

                            list.Add(new
                            {
                                id = "vdi-" + index.ToString("D3"),

                                fullName = userId,
                                email = userId + "@cooperstandard.com",
                                domain = domain,
                                region = region,
                                hostname = "HOST-" + Guid.NewGuid().ToString("N").Substring(0, 6),
                                status = "Active",
                                lastSeen = DateTime.UtcNow.ToString("o"),

                                createdDate = createdDate,
                                createdBy = Convert.ToString(reader["CreatedBy"]),
                                modifiedDate = modifiedDate,
                                modifiedBy = Convert.ToString(reader["ModifiedBy"])
                            });

                            index++;
                        }
                    }
                }

                return Ok(list);
            }
            catch (Exception ex)
            {
                return Content(HttpStatusCode.InternalServerError,
                    new { message = ex.ToString() });
            }
        }

        // ✅ ADD VDI USER
        [HttpPost]
        [Route("")]
        public IHttpActionResult AddUser([FromBody] VdiRequest model)
        {
            try
            {
                if (!IsCurrentUserAdmin())
                {
                    return ForbiddenAdminOnly();
                }

                if (model == null)
                {
                    return Content(HttpStatusCode.BadRequest,
                        new { message = "Request body is required" });
                }

                if (string.IsNullOrWhiteSpace(model.UserId))
                {
                    return Content(HttpStatusCode.BadRequest,
                        new { message = "User ID is required" });
                }

                if (string.IsNullOrWhiteSpace(model.Domain))
                {
                    return Content(HttpStatusCode.BadRequest,
                        new { message = "Domain is required" });
                }

                if (string.IsNullOrWhiteSpace(model.Region))
                {
                    return Content(HttpStatusCode.BadRequest,
                        new { message = "Region is required" });
                }

                string userId = model.UserId.Trim();
                string domain = model.Domain.Trim();
                string region = model.Region.Trim();

                using (var conn = _factory.CreateConnection())
                {
                    conn.Open();

                    string currentUser = GetCurrentUser();
                    DateTime now = DateTime.Now;

                    string tableName = _factory.TableName("mst_vdi_user_detail");

                    // Optional duplicate check
                    string checkSql = @"
                        SELECT COUNT(*)
                        FROM " + tableName + @"
                        WHERE LOWER(UserId) = LOWER(@UserId)
                    ";

                    using (var checkCmd = new MySqlCommand(checkSql, conn))
                    {
                        checkCmd.Parameters.AddWithValue("@UserId", userId);

                        int count = Convert.ToInt32(checkCmd.ExecuteScalar());

                        if (count > 0)
                        {
                            return Content(HttpStatusCode.Conflict,
                                new { message = "VDI user already exists" });
                        }
                    }

                    string sql = @"
                        INSERT INTO " + tableName + @"
                        (UserId, Domain, Region, CreatedDate, CreatedBy, ModifiedDate, ModifiedBy)
                        VALUES
                        (@UserId, @Domain, @Region, @CreatedDate, @CreatedBy, @ModifiedDate, @ModifiedBy)
                    ";

                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        cmd.Parameters.AddWithValue("@UserId", userId);
                        cmd.Parameters.AddWithValue("@Domain", domain);
                        cmd.Parameters.AddWithValue("@Region", region);

                        cmd.Parameters.AddWithValue("@CreatedDate", now);
                        cmd.Parameters.AddWithValue("@CreatedBy", currentUser);
                        cmd.Parameters.AddWithValue("@ModifiedDate", now);
                        cmd.Parameters.AddWithValue("@ModifiedBy", currentUser);

                        cmd.ExecuteNonQuery();
                    }

                    // Return full object for instant UI update
                    return Ok(new
                    {
                        id = "vdi-" + DateTime.Now.Ticks,

                        fullName = userId,
                        email = userId + "@cooperstandard.com",
                        domain = domain,
                        region = region,
                        hostname = "HOST-" + Guid.NewGuid().ToString("N").Substring(0, 6),
                        status = "Active",
                        lastSeen = DateTime.UtcNow.ToString("o"),

                        createdDate = now.ToString("o"),
                        createdBy = currentUser,
                        modifiedDate = now.ToString("o"),
                        modifiedBy = currentUser
                    });
                }
            }
            catch (Exception ex)
            {
                return Content(HttpStatusCode.InternalServerError,
                    new { message = ex.ToString() });
            }
        }

        // ✅ UPDATE VDI USER BY USERID
        [HttpPut]
        [Route("{userId}")]
        public IHttpActionResult UpdateUser([FromUri] string userId, [FromBody] VdiRequest model)
        {
            try
            {
                if (!IsCurrentUserAdmin())
                {
                    return ForbiddenAdminOnly();
                }

                if (string.IsNullOrWhiteSpace(userId))
                {
                    return Content(HttpStatusCode.BadRequest,
                        new { message = "User ID is required" });
                }

                if (model == null)
                {
                    return Content(HttpStatusCode.BadRequest,
                        new { message = "Request body is required" });
                }

                if (string.IsNullOrWhiteSpace(model.Domain))
                {
                    return Content(HttpStatusCode.BadRequest,
                        new { message = "Domain is required" });
                }

                if (string.IsNullOrWhiteSpace(model.Region))
                {
                    return Content(HttpStatusCode.BadRequest,
                        new { message = "Region is required" });
                }

                string routeUserId = userId.Trim();
                string domain = model.Domain.Trim();
                string region = model.Region.Trim();

                using (var conn = _factory.CreateConnection())
                {
                    conn.Open();

                    string currentUser = GetCurrentUser();
                    DateTime now = DateTime.Now;

                    string tableName = _factory.TableName("mst_vdi_user_detail");

                    string sql = @"
                        UPDATE " + tableName + @"
                        SET Domain = @Domain,
                            Region = @Region,
                            ModifiedDate = @ModifiedDate,
                            ModifiedBy = @ModifiedBy
                        WHERE LOWER(UserId) = LOWER(@UserId)
                    ";

                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        cmd.Parameters.AddWithValue("@UserId", routeUserId);
                        cmd.Parameters.AddWithValue("@Domain", domain);
                        cmd.Parameters.AddWithValue("@Region", region);
                        cmd.Parameters.AddWithValue("@ModifiedDate", now);
                        cmd.Parameters.AddWithValue("@ModifiedBy", currentUser);

                        int rows = cmd.ExecuteNonQuery();

                        if (rows == 0)
                        {
                            return Content(HttpStatusCode.NotFound,
                                new { message = "Record not found" });
                        }
                    }

                    // Return full object for instant UI update
                    return Ok(new
                    {
                        fullName = routeUserId,
                        email = routeUserId + "@cooperstandard.com",
                        domain = domain,
                        region = region,
                        hostname = "HOST-" + Guid.NewGuid().ToString("N").Substring(0, 6),
                        status = "Active",
                        lastSeen = DateTime.UtcNow.ToString("o"),

                        modifiedDate = now.ToString("o"),
                        modifiedBy = currentUser
                    });
                }
            }
            catch (Exception ex)
            {
                return Content(HttpStatusCode.InternalServerError,
                    new { message = ex.ToString() });
            }
        }

        // ✅ DELETE VDI USER BY USERID
        [HttpDelete]
        [Route("{userId}")]
        public IHttpActionResult DeleteUser([FromUri] string userId)
        {
            try
            {
                if (!IsCurrentUserAdmin())
                {
                    return ForbiddenAdminOnly();
                }

                if (string.IsNullOrWhiteSpace(userId))
                {
                    return Content(HttpStatusCode.BadRequest,
                        new { message = "User ID is required" });
                }

                using (var conn = _factory.CreateConnection())
                {
                    conn.Open();

                    string tableName = _factory.TableName("mst_vdi_user_detail");

                    string sql = @"
                        DELETE FROM " + tableName + @"
                        WHERE LOWER(UserId) = LOWER(@UserId)
                    ";

                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        cmd.Parameters.AddWithValue("@UserId", userId.Trim());

                        int rows = cmd.ExecuteNonQuery();

                        if (rows == 0)
                        {
                            return Content(HttpStatusCode.NotFound,
                                new { message = "Record not found" });
                        }
                    }
                }

                return Ok(new { message = "User deleted successfully" });
            }
            catch (Exception ex)
            {
                return Content(HttpStatusCode.InternalServerError,
                    new { message = ex.ToString() });
            }
        }

        // ✅ Keep this open for debugging Windows Authentication
        [HttpGet]
        [Route("debug-user")]
        public IHttpActionResult DebugUser()
        {
            string identityName = GetIdentityName();
            string userId = ExtractUserId(identityName);

            bool isAuthenticated =
                User != null &&
                User.Identity != null &&
                User.Identity.IsAuthenticated &&
                !string.IsNullOrWhiteSpace(userId);

            bool isAdmin = false;

            try
            {
                if (isAuthenticated)
                {
                    isAdmin = IsCurrentUserAdmin();
                }
            }
            catch
            {
                isAdmin = false;
            }

            return Ok(new
            {
                identityName = identityName,
                userId = userId,
                isAuthenticated = isAuthenticated,
                authType = User != null && User.Identity != null
                    ? User.Identity.AuthenticationType
                    : "",
                isAdmin = isAdmin,
                role = isAdmin ? "Administrator" : "User"
            });
        }
    }

    // ✅ REQUEST MODEL
    public class VdiRequest
    {
        public string UserId { get; set; }
        public string Domain { get; set; }
        public string Region { get; set; }
    }
}