using System.Data;
using Dapper;

namespace FinanceDashboard.Api.Data;

public class DateOnlyTypeHandler : SqlMapper.TypeHandler<DateOnly>
{
    public override void SetValue(IDbDataParameter parameter, DateOnly value)
    {
        parameter.DbType = DbType.Date;
        parameter.Value = value.ToDateTime(TimeOnly.MinValue);
    }

    public override DateOnly Parse(object value)
    {
        if (value is DateOnly d) return d;
        if (value is DateTime dt) return DateOnly.FromDateTime(dt);
        if (value is string s && DateOnly.TryParse(s, out var parsed)) return parsed;
        return DateOnly.FromDateTime(Convert.ToDateTime(value));
    }
}

public class NullableDateOnlyTypeHandler : SqlMapper.TypeHandler<DateOnly?>
{
    public override void SetValue(IDbDataParameter parameter, DateOnly? value)
    {
        parameter.DbType = DbType.Date;
        if (value.HasValue)
        {
            parameter.Value = value.Value.ToDateTime(TimeOnly.MinValue);
        }
        else
        {
            parameter.Value = DBNull.Value;
        }
    }

    public override DateOnly? Parse(object? value)
    {
        if (value == null || value is DBNull) return null;
        if (value is DateOnly d) return d;
        if (value is DateTime dt) return DateOnly.FromDateTime(dt);
        if (value is string s && DateOnly.TryParse(s, out var parsed)) return parsed;
        return DateOnly.FromDateTime(Convert.ToDateTime(value));
    }
}
