using MySqlConnector;
using System;
using System.Net;
using System.Net.Http;
using System.Web;
using System.Web.Http;
using UMT.Backend.Services;

namespace UMT.Backend.Controllers
{
    [RoutePrefix("api/auth")]
    public class AuthController : ApiController
    {
        private readonly MySqlConnectionFactory _factory = new MySqlConnectionFactory();

        // GET: /api/auth/me
        [HttpGet]
        [Route("me")]
        public HttpResponseMessage GetCurrentUser()
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

                if (string.IsNullOrWhiteSpace(userId))
                {
                    return Request.CreateResponse(HttpStatusCode.OK, new
                    {
                        message = "Windows user identity not found.",
                        identityName = identityName,
                        userId = "",
                        isAuthenticated = false,
                        isAdmin = false,
                        role = "User"
                    });
                }

                bool isAdmin = IsUserAdmin(userId);

                return Request.CreateResponse(HttpStatusCode.OK, new
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
                return Request.CreateResponse(HttpStatusCode.InternalServerError, new
                {
                    message = ex.ToString()
                });
            }
        }

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

            // Handles DOMAIN\userid
            int index = identityName.LastIndexOf('\\');

            // Handles DOMAIN/userid
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

        private bool IsUserAdmin(string userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                return false;
            }

            using (var conn = _factory.CreateConnection())
            {
                conn.Open();

                string sql =
                    "SELECT COUNT(1) FROM " + _factory.TableName("mst_cooper_admins") +
                    " WHERE LOWER(UserId) = LOWER(@UserId)";

                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@UserId", userId.Trim());

                    object result = cmd.ExecuteScalar();

                    int count = Convert.ToInt32(result);

                    return count > 0;
                }
            }
        }
    }
}