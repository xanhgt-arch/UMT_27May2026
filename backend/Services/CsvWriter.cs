using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace UMT.Backend.Services
{
    public static class CsvWriter
    {
        public static string Write(
            List<string> columns,
            List<Dictionary<string, object>> rows)
        {
            var builder = new StringBuilder();
            AppendRow(builder, columns);

            foreach (var row in rows)
            {
                var values = new List<string>();

                foreach (var col in columns)
                {
                    values.Add(FormatValue(row[col]));
                }

                AppendRow(builder, values);
            }

            return builder.ToString();
        }

        private static void AppendRow(StringBuilder builder, IEnumerable<string> values)
        {
            bool first = true;

            foreach (var value in values)
            {
                if (!first)
                    builder.Append(',');

                builder.Append(Escape(value ?? ""));
                first = false;
            }

            builder.AppendLine();
        }

        private static string FormatValue(object value)
        {
            if (value == null)
                return "";

            if (value is DateTime)
                return ((DateTime)value).ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);

            return Convert.ToString(value, CultureInfo.InvariantCulture);
        }

        private static string Escape(string value)
        {
            if (!value.Contains("\"") && !value.Contains(",") && !value.Contains("\r") && !value.Contains("\n"))
                return value;

            return "\"" + value.Replace("\"", "\"\"") + "\"";
        }
    }
}
