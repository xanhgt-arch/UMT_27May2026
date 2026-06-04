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
    [RoutePrefix("api/admin")]
    public class AdminController : ApiController
    {
        private readonly MySqlConnectionFactory _factory = new MySqlConnectionFactory();

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
                HttpContext.Current.User.Identity != null &&
                !string.IsNullOrWhiteSpace(HttpContext.Current.User.Identity.Name))
            {
                identityName = HttpContext.Current.User.Identity.Name;
            }

            return identityName;
        }

        private string ExtractUserId(string identityName)
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

        private string GetCurrentUser()
        {
            string identityName = GetIdentityName();
            string userId = ExtractUserId(identityName);

            if (string.IsNullOrWhiteSpace(userId))
            {
                return "UNKNOWN";
            }

            return userId;
        }

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

                string tableName = _factory.TableName("mst_cooper_admins");

                string sql =
                    "SELECT COUNT(*) FROM " + tableName +
                    " WHERE LOWER(UserId) = LOWER(@UserId)";

                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@UserId", currentUserId.Trim());

                    int count = Convert.ToInt32(cmd.ExecuteScalar());

                    return count > 0;
                }
            }
        }

        private IHttpActionResult ForbiddenAdminOnly()
        {
            return Ok(new List<object>());
        }

        [HttpGet]
        [Route("current-user")]
        public IHttpActionResult GetCurrentUserInfo()
        {
            try
            {
                string identityName = GetIdentityName();
                string userId = ExtractUserId(identityName);

                bool isAuthenticated = false;

                if (User != null && User.Identity != null)
                {
                    isAuthenticated = User.Identity.IsAuthenticated;
                }

                bool isAdmin = false;

                if (!string.IsNullOrWhiteSpace(userId))
                {
                    isAdmin = IsCurrentUserAdmin();
                }

                return Ok(new
                {
                    identityName = identityName,
                    userId = userId,
                    isAuthenticated = isAuthenticated,
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

                    string sql = "SELECT * FROM " + _factory.TableName("mst_cooper_admins");

                    using (var cmd = new MySqlCommand(sql, conn))
                    using (var reader = cmd.ExecuteReader())
                    {
                        int index = 1;

                        while (reader.Read())
                        {
                            string userId = Convert.ToString(reader["UserId"]);

                            string addedOn = reader["AddedOn"] != DBNull.Value
                                ? Convert.ToDateTime(reader["AddedOn"]).ToString("o")
                                : null;

                            list.Add(new
                            {
                                id = "adm-" + index.ToString("D3"),
                                fullName = userId,
                                addedBy = Convert.ToString(reader["AddedBy"]),
                                addedOn = addedOn
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

        [HttpPost]
        [Route("")]
        public IHttpActionResult Add([FromBody] AdminRequest model)
        {
            try
            {
                if (!IsCurrentUserAdmin())
                {
                    return ForbiddenAdminOnly();
                }

                if (model == null || string.IsNullOrWhiteSpace(model.UserId))
                {
                    return Content(HttpStatusCode.BadRequest,
                        new { message = "Admin ID is required" });
                }

                string userId = model.UserId.Trim();
                string currentUser = GetCurrentUser();
                DateTime now = DateTime.Now;

                using (var conn = _factory.CreateConnection())
                {
                    conn.Open();

                    string tableName = _factory.TableName("mst_cooper_admins");

                    string checkSql = "SELECT COUNT(*) FROM " + tableName +
                        " WHERE LOWER(UserId) = LOWER(@UserId)";

                    using (var checkCmd = new MySqlCommand(checkSql, conn))
                    {
                        checkCmd.Parameters.AddWithValue("@UserId", userId);

                        int count = Convert.ToInt32(checkCmd.ExecuteScalar());

                        if (count > 0)
                        {
                            return Content(HttpStatusCode.Conflict,
                                new { message = "Admin already exists" });
                        }
                    }

                    string sql =
                        "INSERT INTO " + tableName +
                        " (UserId, AddedOn, AddedBy) " +
                        " VALUES (@UserId, @AddedOn, @AddedBy)";

                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        cmd.Parameters.AddWithValue("@UserId", userId);
                        cmd.Parameters.AddWithValue("@AddedOn", now);
                        cmd.Parameters.AddWithValue("@AddedBy", currentUser);

                        cmd.ExecuteNonQuery();
                    }
                }

                return Ok(new
                {
                    id = "adm-" + DateTime.Now.Ticks,
                    fullName = userId,
                    addedBy = currentUser,
                    addedOn = now.ToString("o")
                });
            }
            catch (Exception ex)
            {
                return Content(HttpStatusCode.InternalServerError,
                    new { message = ex.ToString() });
            }
        }

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
                        new { message = "Admin ID is required" });
                }

                string userIdToDelete = userId.Trim();
                string currentUser = GetCurrentUser();

                if (string.Equals(currentUser, userIdToDelete, StringComparison.OrdinalIgnoreCase))
                {
                    return Content(HttpStatusCode.BadRequest, new
                    {
                        message = "You cannot delete your own admin access."
                    });
                }

                using (var conn = _factory.CreateConnection())
                {
                    conn.Open();

                    string tableName = _factory.TableName("mst_cooper_admins");

                    string sql =
                        "DELETE FROM " + tableName +
                        " WHERE LOWER(UserId) = LOWER(@UserId)";

                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        cmd.Parameters.AddWithValue("@UserId", userIdToDelete);

                        int rows = cmd.ExecuteNonQuery();

                        if (rows == 0)
                        {
                            return Content(HttpStatusCode.NotFound,
                                new { message = "Admin not found" });
                        }
                    }
                }

                return Ok(new
                {
                    message = "Admin deleted successfully"
                });
            }
            catch (Exception ex)
            {
                return Content(HttpStatusCode.InternalServerError,
                    new { message = ex.ToString() });
            }
        }
    }

    public class AdminRequest
    {
        public string UserId { get; set; }
    }
}

