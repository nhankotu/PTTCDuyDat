using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FinanceDashboard.Api.Models;

[Table("contract_daily_balance")]
public class ContractDailyBalance
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("contract_id")]
    public long ContractId { get; set; }

    [Column("batch_id")]
    public int BatchId { get; set; }

    [Column("balance_date")]
    public DateTime BalanceDate { get; set; }

    [Column("balance_amount")]
    public decimal BalanceAmount { get; set; }
}
