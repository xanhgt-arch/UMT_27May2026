using System.Web.Http;
using System.Web.Http.Cors;

namespace UMT.Backend
{
    public static class WebApiConfig
    {
        public static void Register(HttpConfiguration config)
        {
            //enable cors
            
            var cors = new EnableCorsAttribute("*", "*", "*"); // allow all
            config.EnableCors(cors);

            config.Formatters.Remove(config.Formatters.XmlFormatter);


            // enable attribute routing
            config.MapHttpAttributeRoutes();

            // fallback route
            config.Routes.MapHttpRoute(
                name: "DefaultApi",
                routeTemplate: "api/{controller}/{id}",
                defaults: new { id = RouteParameter.Optional }
            );
        }
    }
}