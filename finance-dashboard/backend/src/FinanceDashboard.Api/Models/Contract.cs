using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FinanceDashboard.Api.Models;

[Table("contract")]
public class Contract
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("batch_id")]
    public int BatchId { get; set; }

    [Column("stt")]
    public int? Stt { get; set; }

    [Column("appendix_number")]
    [MaxLength(150)]
    public string AppendixNumber { get; set; } = string.Empty;

    [Column("contract_number")]
    [MaxLength(100)]
    public string? ContractNumber { get; set; }

    [Column("customer_code")]
    [MaxLength(50)]
    public string? CustomerCode { get; set; }

    [Column("customer_name")]
    [MaxLength(255)]
    public string? CustomerName { get; set; }

    [Column("product_name_raw")]
    [MaxLength(200)]
    public string? ProductNameRaw { get; set; }

    [Column("product_group")]
    [MaxLength(100)]
    public string ProductGroup { get; set; } = string.Empty;

    [Column("term_raw")]
    [MaxLength(50)]
    public string? TermRaw { get; set; }

    [Column("term_group")]
    [MaxLength(50)]
    public string? TermGroup { get; set; }

    [Column("interest_rate_raw")]
    [MaxLength(30)]
    public string? InterestRateRaw { get; set; }

    [Column("interest_rate")]
    public decimal? InterestRate { get; set; }

    [Column("estimated_interest")]
    public decimal EstimatedInterest { get; set; }

    [Column("interest_payment_method")]
    [MaxLength(50)]
    public string? InterestPaymentMethod { get; set; }

    [Column("contract_value")]
    public decimal ContractValue { get; set; }

    [Column("liquidated_amount")]
    public decimal LiquidatedAmount { get; set; }

    [Column("sign_date")]
    public DateTime? SignDate { get; set; }

    [Column("expire_date")]
    public DateTime? ExpireDate { get; set; }

    [Column("liquidate_date")]
    public DateTime? LiquidateDate { get; set; }

    [Column("is_liquidated")]
    public bool IsLiquidated { get; set; }

    [Column("status")]
    [MaxLength(50)]
    public string? Status { get; set; }

    [Column("channel")]
    [MaxLength(50)]
    public string? Channel { get; set; }

    [Column("settlement_channel")]
    [MaxLength(50)]
    public string? SettlementChannel { get; set; }

    [Column("user_active")]
    public int UserActive { get; set; }

    [Column("ds_type")]
    [MaxLength(1)]
    public string DsType { get; set; } = "v";

    [Column("partial_settle_date")]
    public DateTime? PartialSettleDate { get; set; }

    [Column("partial_settle_amount")]
    public decimal PartialSettleAmount { get; set; }

    [Column("dsqd_no_early_withdraw")]
    public decimal DsqdNoEarlyWithdraw { get; set; }

    [Column("dsqd_early_withdraw")]
    public decimal DsqdEarlyWithdraw { get; set; }

    [Column("id_sale_intro")]
    [MaxLength(100)]
    public string? IdSaleIntro { get; set; }

    [Column("sale_id")]
    [MaxLength(50)]
    public string? SaleId { get; set; }

    [Column("final_sale_id")]
    [MaxLength(50)]
    public string? FinalSaleId { get; set; }

    [Column("final_sale_name")]
    [MaxLength(200)]
    public string? FinalSaleName { get; set; }

    [Column("manager_l1_id")]
    [MaxLength(50)]
    public string? ManagerL1Id { get; set; }

    [Column("manager_l1_name")]
    [MaxLength(200)]
    public string? ManagerL1Name { get; set; }

    [Column("manager_l2_id")]
    [MaxLength(50)]
    public string? ManagerL2Id { get; set; }

    [Column("manager_l3_id")]
    [MaxLength(50)]
    public string? ManagerL3Id { get; set; }

    [Column("manager_l4_id")]
    [MaxLength(50)]
    public string? ManagerL4Id { get; set; }

    [Column("sale_branch")]
    [MaxLength(150)]
    public string? SaleBranch { get; set; }

    [Column("sale_department")]
    [MaxLength(150)]
    public string? SaleDepartment { get; set; }

    [Column("transaction_office")]
    [MaxLength(150)]
    public string? TransactionOffice { get; set; }

    [Column("balance_prev_day")]
    public decimal BalancePrevDay { get; set; }

    [Column("balance_prev_month_end")]
    public decimal BalancePrevMonthEnd { get; set; }

    [Column("balance_prev_week_end")]
    public decimal BalancePrevWeekEnd { get; set; }

    [Column("balance_current")]
    public decimal BalanceCurrent { get; set; }

    [Column("raw_json", TypeName = "jsonb")]
    public string? RawJson { get; set; }
}
