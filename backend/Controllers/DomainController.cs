using MySqlConnector;
using System;
using System.Collections.Generic;
using System.Net;
using System.Web.Http;
using UMT.Backend.Services;

namespace UMT.Backend.Controllers
{
    [RoutePrefix("api/domain")]
    public class DomainController : ApiController
    {
        private readonly MySqlConnectionFactory _factory = new MySqlConnectionFactory();

        // ==========================================================
        // Gets only UserId from DOMAIN\UserId or DOMAIN/UserId
        // ==========================================================
        private string GetCurrentUser()
        {
            string identityName = "";

            if (User != null && User.Identity != null && !string.IsNullOrWhiteSpace(User.Identity.Name))
            {
                identityName = User.Identity.Name;
            }

            if (string.IsNullOrWhiteSpace(identityName))
            {
                return "UNKNOWN";
            }

            identityName = identityName.Trim();

            int slashIndex = identityName.LastIndexOf('\\');

            if (slashIndex < 0)
            {
                slashIndex = identityName.LastIndexOf('/');
            }

            if (slashIndex >= 0 && slashIndex < identityName.Length - 1)
            {
                return identityName.Substring(slashIndex + 1);
            }

            return identityName;
        }

        // ==========================================================
        // Checks if current Windows user exists in mst_cooper_admins
        // ==========================================================
        private bool IsCurrentUserAdmin()
        {
            string currentUser = GetCurrentUser();

            if (string.IsNullOrWhiteSpace(currentUser) ||
                currentUser.Equals("UNKNOWN", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            using (var conn = _factory.CreateConnection())
            {
                conn.Open();

                string sql = "SELECT COUNT(*) FROM " + _factory.TableName("mst_cooper_admins") +
                             " WHERE LOWER(UserId) = LOWER(@UserId)";

                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@UserId", currentUser);

                    int count = Convert.ToInt32(cmd.ExecuteScalar());

                    return count > 0;
                }
            }
        }

        private IHttpActionResult ForbiddenAdminOnly()
        {
            return Ok(new List<object>());
        }

        // ✅ GET ALL
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

                    string sql = "SELECT * FROM " + _factory.TableName("mst_domain_details");

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
                                id = "dom-" + index.ToString("D3"),

                                fullName = userId,

                                technicalDomain = domain,
                                corporateGroup = domain,
                                domain = domain,
                                region = region,

                                active = true,

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

        // ✅ ADD DOMAIN USER
        [HttpPost]
        [Route("")]
        public IHttpActionResult Add([FromBody] DomainRequest model)
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
                        new { message = "UserId is required" });
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

                    string tableName = _factory.TableName("mst_domain_details");

                    string checkSql = "SELECT COUNT(*) FROM " + tableName +
                                      " WHERE LOWER(UserId) = LOWER(@UserId)";

                    using (var checkCmd = new MySqlCommand(checkSql, conn))
                    {
                        checkCmd.Parameters.AddWithValue("@UserId", userId);

                        int count = Convert.ToInt32(checkCmd.ExecuteScalar());

                        if (count > 0)
                        {
                            return Content(HttpStatusCode.Conflict,
                                new { message = "Domain mapping already exists for this user" });
                        }
                    }

                    string sql = "INSERT INTO " + tableName +
                                 " (UserId, Domain, Region, CreatedDate, CreatedBy, ModifiedDate, ModifiedBy) " +
                                 " VALUES (@UserId, @Domain, @Region, @CreatedDate, @CreatedBy, @ModifiedDate, @ModifiedBy)";

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

                    return Ok(new
                    {
                        id = Guid.NewGuid().ToString(),

                        fullName = userId,
                        technicalDomain = domain,
                        corporateGroup = domain,
                        domain = domain,
                        region = region,

                        active = true,

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

        // ✅ UPDATE DOMAIN USER BY USERID
        [HttpPut]
        [Route("{userId}")]
        public IHttpActionResult Update(string userId, [FromBody] DomainRequest model)
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
                        new { message = "UserId is required" });
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

                    string tableName = _factory.TableName("mst_domain_details");

                    string sql = "UPDATE " + tableName +
                                 " SET Domain = @Domain, " +
                                 " Region = @Region, " +
                                 " ModifiedDate = @ModifiedDate, " +
                                 " ModifiedBy = @ModifiedBy " +
                                 " WHERE LOWER(UserId) = LOWER(@UserId)";

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

                    return Ok(new
                    {
                        fullName = routeUserId,

                        technicalDomain = domain,
                        corporateGroup = domain,
                        domain = domain,
                        region = region,

                        active = true,

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

        // ✅ DELETE DOMAIN USER BY USERID
        [HttpDelete]
        [Route("{userId}")]
        public IHttpActionResult Delete(string userId)
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
                        new { message = "UserId is required" });
                }

                using (var conn = _factory.CreateConnection())
                {
                    conn.Open();

                    string tableName = _factory.TableName("mst_domain_details");

                    string sql = "DELETE FROM " + tableName +
                                 " WHERE LOWER(UserId) = LOWER(@UserId)";

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

                return Ok(new { message = "Domain user deleted successfully" });
            }
            catch (Exception ex)
            {
                return Content(HttpStatusCode.InternalServerError,
                    new { message = ex.ToString() });
            }
        }

        // ✅ DEBUG CURRENT USER
        [HttpGet]
        [Route("debug-user")]
        public IHttpActionResult DebugUser()
        {
            try
            {
                string identityName = "";

                if (User != null && User.Identity != null)
                {
                    identityName = User.Identity.Name;
                }

                string currentUser = GetCurrentUser();
                bool isAuthenticated = false;

                if (User != null && User.Identity != null)
                {
                    isAuthenticated = User.Identity.IsAuthenticated;
                }

                bool isAdmin = IsCurrentUserAdmin();

                return Ok(new
                {
                    identityName = identityName,
                    userId = currentUser,
                    isAuthenticated = isAuthenticated,
                    authType = User != null && User.Identity != null ? User.Identity.AuthenticationType : "",
                    isAdmin = isAdmin,
                    role = isAdmin ? "Administrator" : "User"
                });
            }
            catch (Exception ex)
            {
                return Content(HttpStatusCode.InternalServerError,
                    new { message = ex.ToString() });
            }
        }
    }

    public class DomainRequest
    {
        public string UserId { get; set; }
        public string Domain { get; set; }
        public string Region { get; set; }
    }
}