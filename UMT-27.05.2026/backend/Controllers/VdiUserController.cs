using MySqlConnector;
using System;
using System.Collections.Generic;
using System.Net;
using System.Web.Http;
using UMT.Backend.Services;

namespace UMT.Backend.Controllers
{
    [RoutePrefix("api/vdi")]
    public class VdiController : ApiController
    {

        
        private readonly MySqlConnectionFactory _factory = new MySqlConnectionFactory();

        private string GetCurrentUser()
        {
            return !string.IsNullOrWhiteSpace(User?.Identity?.Name)
                ? User.Identity.Name
                : "ADMIN";
        }

        [HttpGet]
        [Route("")]
        public IHttpActionResult GetAll()
        {
            try
            {
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

                                // ✅ NEW FIELDS
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
                return Content(HttpStatusCode.InternalServerError, new { message = ex.ToString() });
            }
        }

        // ✅ ADD USER
        [HttpPost]
        [Route("")]
        public IHttpActionResult AddUser([FromBody] VdiRequest model)
        {
            try
            {
                using (var conn = _factory.CreateConnection())
                {
                    conn.Open();

                    string currentUser = GetCurrentUser();
                    DateTime now = DateTime.Now;

                    string sql = @"
                        INSERT INTO mst_vdi_user_detail
                        (UserId, Domain, Region, CreatedDate, CreatedBy, ModifiedDate, ModifiedBy)
                        VALUES
                        (@UserId, @Domain, @Region, @CreatedDate, @CreatedBy, @ModifiedDate, @ModifiedBy)
                    ";

                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        cmd.Parameters.AddWithValue("@UserId", model.UserId);
                        cmd.Parameters.AddWithValue("@Domain", model.Domain);
                        cmd.Parameters.AddWithValue("@Region", model.Region);

                        cmd.Parameters.AddWithValue("@CreatedDate", now);
                        cmd.Parameters.AddWithValue("@CreatedBy", currentUser);
                        cmd.Parameters.AddWithValue("@ModifiedDate", now);
                        cmd.Parameters.AddWithValue("@ModifiedBy", currentUser);

                        cmd.ExecuteNonQuery();
                    }
                }

                return Ok(new { message = "User added successfully" });
            }
            catch (Exception ex)
            {
                return Content(HttpStatusCode.InternalServerError, new { message = ex.ToString() });
            }
        }

        // ✅ UPDATE USER
        [HttpPut]
        [Route("{userId}")]
        public IHttpActionResult UpdateUser(string userId, [FromBody] VdiRequest model)
        {
            try
            {
                
                using (var conn = _factory.CreateConnection())
                {
                    conn.Open();

                    string currentUser = GetCurrentUser();
                    DateTime now = DateTime.Now;

                    string sql = @"
                        UPDATE mst_vdi_user_detail
                        SET Domain = @Domain,
                            Region = @Region,
                            ModifiedDate = @ModifiedDate,
                            ModifiedBy = @ModifiedBy
                        WHERE LOWER(UserId) = LOWER(@UserId)
                    ";

                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        cmd.Parameters.AddWithValue("@UserId", userId);
                        cmd.Parameters.AddWithValue("@Domain", model.Domain);
                        cmd.Parameters.AddWithValue("@Region", model.Region);
                        cmd.Parameters.AddWithValue("@ModifiedDate", now);
                        cmd.Parameters.AddWithValue("@ModifiedBy", currentUser);

                        cmd.ExecuteNonQuery();
                    }
                }

                return Ok(new { message = "User updated successfully" });
            }
            catch (Exception ex)
            {
                return Content(HttpStatusCode.InternalServerError, new { message = ex.ToString() });
            }
        }

        // ✅ DELETE USER
        [HttpDelete]
        [Route("{userId}")]
        public IHttpActionResult DeleteUser(string userId)
        {
            try
            {
                using (var conn = _factory.CreateConnection())
                {
                    conn.Open();

                    string sql = "DELETE FROM mst_vdi_user_detail WHERE LOWER(UserId) = LOWER(@UserId)";

                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        cmd.Parameters.AddWithValue("@UserId", userId);
                        cmd.ExecuteNonQuery();
                    }
                }

                return Ok(new { message = "User deleted successfully" });
            }
            catch (Exception ex)
            {
                return Content(HttpStatusCode.InternalServerError, new { message = ex.ToString() });
            }
        }
    }

    // ✅ REQUEST MODEL (important)
    public class VdiRequest
    {
        public string UserId { get; set; }
        public string Domain { get; set; }
        public string Region { get; set; }
    }

    

}