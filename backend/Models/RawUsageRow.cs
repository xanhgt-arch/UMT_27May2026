using MySqlConnector;
using System;

namespace UMT.Backend.Models
{
    public class RawUsageRow
    {
        public int SrNo { get; set; }
        public string ApplicationName { get; set; }
        public string Functionality { get; set; }
        public string CadTool { get; set; }
        public string UserID { get; set; }
        public string MachineID { get; set; }
        public string Domain { get; set; }
        public string Region { get; set; }
        public string ProductLine { get; set; }
        public object StartTime { get; set; }
        public object StopTime { get; set; }
        public string Status { get; set; }
        public object IsVDI { get; set; }
        public object IsProd { get; set; }

        public static RawUsageRow FromReader(MySqlDataReader reader)
        {
            return new RawUsageRow
            {
                SrNo = ToInt32(reader["SrNo"]),
                ApplicationName = ToStringOrNull(reader["ApplicationName"]),
                Functionality = ToStringOrNull(reader["Functionality"]),
                CadTool = ToStringOrNull(reader["CadTool"]),
                UserID = ToStringOrNull(reader["UserID"]),
                MachineID = ToStringOrNull(reader["MachineID"]),
                Domain = ToStringOrNull(reader["Domain"]),
                Region = ToStringOrNull(reader["Region"]),
                ProductLine = ToStringOrNull(reader["ProductLine"]),
                StartTime = ToValueOrNull(reader["StartTime"]),
                StopTime = ToValueOrNull(reader["StopTime"]),
                Status = ToStringOrNull(reader["Status"]),
                IsVDI = ToValueOrNull(reader["IsVDI"]),
                IsProd = ToValueOrNull(reader["IsProd"])
            };
        }

        private static int ToInt32(object value)
        {
            return value == null || value == DBNull.Value ? 0 : Convert.ToInt32(value);
        }

        private static string ToStringOrNull(object value)
        {
            return value == null || value == DBNull.Value ? null : Convert.ToString(value);
        }

        private static object ToValueOrNull(object value)
        {
            return value == null || value == DBNull.Value ? null : value;
        }
    }
}
