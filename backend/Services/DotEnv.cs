using System;
using System.IO;

namespace UMT.Backend.Services
{
    public static class DotEnv
    {
        public static void Load(string path)
        {
            if (!File.Exists(path))
                return;

            foreach (var line in File.ReadLines(path))
            {
                var trimmed = line.Trim();

                if (trimmed.Length == 0 || trimmed.StartsWith("#"))
                    continue;

                int separator = trimmed.IndexOf('=');

                if (separator <= 0)
                    continue;

                var key = trimmed.Substring(0, separator).Trim();
                var value = trimmed.Substring(separator + 1).Trim().Trim('\"');

                if (Environment.GetEnvironmentVariable(key) == null)
                {
                    Environment.SetEnvironmentVariable(key, value);
                }
            }
        }
    }
}
