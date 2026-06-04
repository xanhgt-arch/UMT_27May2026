using System.Diagnostics;
using System.Threading.Tasks;
using System.Web;
using System.Web.Http;

namespace UMT.Backend
{
    public class WebApiApplication : HttpApplication
    {
        protected void Application_Start()
        {
            string envPath = Server.MapPath(".env");
            Services.DotEnv.Load(envPath);

            GlobalConfiguration.Configure(WebApiConfig.Register);

            Task.Run(async () =>
            {
                try
                {
                    var service = new Services.RawSessionsService(
                        new Services.MySqlConnectionFactory());

                    await service.GenerateJson();
                }
                catch (System.Exception ex)
                {
                    Trace.TraceWarning("Startup JSON generation skipped: " + ex.Message);
                }
            });
        }

    }
}
