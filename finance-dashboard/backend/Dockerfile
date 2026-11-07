FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY src/FinanceDashboard.Api/FinanceDashboard.Api.csproj ./FinanceDashboard.Api/
RUN dotnet restore FinanceDashboard.Api/FinanceDashboard.Api.csproj

COPY src/FinanceDashboard.Api/ ./FinanceDashboard.Api/
WORKDIR /src/FinanceDashboard.Api
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "FinanceDashboard.Api.dll"]
