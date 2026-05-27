using MySqlConnector;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Threading.Tasks;

namespace UMT.Backend.Services
{
    public class MySqlConnectionFactory
    {
        private readonly string _connectionString;

        public MySqlConnectionFactory()
        {
            var server = GetRequiredSetting("DB_HOST");
            var user = GetRequiredSetting("DB_USER");
            var password = GetRequiredSetting("DB_PASSWORD");
            var database = GetRequiredSetting("DB_NAME");
            var port = GetPort();

            var builder = new MySqlConnectionStringBuilder();

            builder.Server = server;
            builder.Port = port;
            builder.UserID = user;
            builder.Password = password;
            builder.Database = database;

            builder.Pooling = true;
            builder.MinimumPoolSize = 0;
            builder.MaximumPoolSize = 10;
            builder.ConnectionTimeout = 15;
            builder.DefaultCommandTimeout = 120;
            builder.SslMode = MySqlSslMode.None;

            _connectionString = builder.ConnectionString;
        }

        public MySqlConnection CreateConnection()
        {
            return new MySqlConnection(_connectionString);
        }

        public async Task<QueryTable> QueryTableAsync(string sql)
        {
            var columns = new List<string>();
            var rows = new List<Dictionary<string, object>>();

            using (var connection = CreateConnection())
            {
                await connection.OpenAsync();

                using (var command = new MySqlCommand(sql, connection))
                {
                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        // Get column names
                        for (int i = 0; i < reader.FieldCount; i++)
                        {
                            columns.Add(reader.GetName(i));
                        }

                        // Read rows
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

        public string TableName(string table)
        {
            return QuoteIdentifier(GetRequiredSetting("DB_NAME")) + "." + QuoteIdentifier(table);
        }

        private static string GetRequiredSetting(string key)
        {
            var value = Environment.GetEnvironmentVariable(key);

            if (string.IsNullOrWhiteSpace(value))
                throw new InvalidOperationException("Missing required database setting: " + key);

            return value.Trim();
        }

        private static uint GetPort()
        {
            var value = Environment.GetEnvironmentVariable("DB_PORT");

            if (string.IsNullOrWhiteSpace(value))
                return 3306;

            uint port;
            if (!uint.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out port) || port == 0 || port > 65535)
                throw new InvalidOperationException("DB_PORT must be a number between 1 and 65535.");

            return port;
        }

        private static string QuoteIdentifier(string identifier)
        {
            if (string.IsNullOrWhiteSpace(identifier))
                throw new ArgumentException("Identifier cannot be empty.", "identifier");

            return "`" + identifier.Replace("`", "``") + "`";
        }
    }

    public class QueryTable
    {
        public List<string> Columns { get; set; }
        public List<Dictionary<string, object>> Rows { get; set; }

        public QueryTable(List<string> columns, List<Dictionary<string, object>> rows)
        {
            Columns = columns;
            Rows = rows;
        }
    }
}
