import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { BancorTesting } from "../target/types/bancor_testing";

export const TARGET_DECIMALS = 6;
export const TARGET_DECIMAL_MODIFIER = 10 ** TARGET_DECIMALS;

describe("bancor-testing", () => {
  // Configure the client to use the local cluster.
  // anchor.setProvider(anchor.Provider.env());

  // const program = anchor.workspace.BancorTesting as Program<BancorTesting>;

  // it('Is initialized!', async () => {
  //   // Add your test here.
  //   const tx = await program.rpc.initialize({});
  //   console.log("Your transaction signature", tx);
  // });

  interface Market {
    targetTokenSupply: number;
    reserveBalance: number;
    reserveRatio: number;
    preMine: number;
    initialPrice: number;
    supportBalance: number;
  }
  let market: Market = {
    targetTokenSupply: 1, //100m assuming max supply is 1b
    reserveBalance: 0.5, //0.0005, // * TARGET_DECIMAL_MODIFIER,
    reserveRatio: 0.5,
    preMine: 0,
    initialPrice: 10,
    supportBalance: 10,
  };
  interface User {
    reserveTokenBalance: number;
    targetTokenBalance: number;
  }
  let user: User = {
    reserveTokenBalance: 20000 * TARGET_DECIMAL_MODIFIER,
    targetTokenBalance: 0,
  };
  it("testing", async () => {
    /*
    reserve ratio maintains a constant between the token's market cap and its treasury reserves
    if you assume that the funds going into the treasury will match 1:1 with the tokens coming out of the reserves
    then this can be modeled like a normal bonding curve
    */

    buy(99, market, user);
    //fillReserve(market, 10);

    //buy(10, market, user);
    buy(100, market, user);
    buy(100, market, user);
    //buy(0.00001, market, user);

    //so this makes it more steep the more money u add into it?
    //yes bc it's adjusting the slope to make it more steep
    sell(100, market, user);
    sell(100, market, user);
    // sell(10, market, user);

    //buy(0.0001, market, user);
    //its bc i have decimals with num so buying 1 is really like buying 1000
  });

  /*
open questions
how do u start at a particular price? i think u could just add it manually
u can just build it with starting price
  */

  const buy = (targets: number, market: Market, user: User) => {
    console.log("");
    console.log("BUYING");
    console.log("targets received:", targets);
    let reserveChange = reserveValueOnBuy(targets, market);
    let supportChange = supportValue(targets, market);
    console.log("total cost to user: ", reserveChange);
    market.reserveBalance += reserveChange;
    market.targetTokenSupply += targets;
    market.supportBalance += supportChange;
    user.reserveTokenBalance -= reserveChange + supportChange;
    user.targetTokenBalance += targets;
    console.log(
      "price per token: ",
      (reserveChange + supportChange) / targets,
      "reserve"
    );
    printMarketStatus(market);
  };

  const supportValue = (targets: number, market: Market) => {
    return targets * market.initialPrice;
  };

  //im trying to push the reserve value down by a constant
  //reserveValue = collateral * ((1 + targets / targetSupply)^(1/reserveRatio) — 1)
  const reserveValueOnBuy = (targets: number, market: Market) => {
    let curveSupply = market.targetTokenSupply - market.preMine;
    let base = 1 + targets / curveSupply;
    let ex = Math.pow(base, 1 / market.reserveRatio) - 1;
    let whole = market.reserveBalance * ex;
    console.log("whole", whole);
    return whole;
  };

  const sell = (targets: number, market: Market, user: User) => {
    if (market.targetTokenSupply - targets < market.preMine) {
      //selling into the premine portion
      targets = market.targetTokenSupply - market.preMine;
    }
    console.log("");
    console.log("SELLING");
    console.log("targets sold:", targets);
    let reserveChange = reserveValueOnSell(targets, market);
    let supportChange = supportValue(targets, market);
    console.log("reserve value on sell: ", reserveChange);
    market.reserveBalance -= reserveChange;
    market.targetTokenSupply -= targets;
    market.supportBalance -= supportChange;
    user.reserveTokenBalance += reserveChange + supportChange;
    user.targetTokenBalance -= targets;
    console.log(
      "price per token: ",
      (reserveChange + supportChange) / targets,
      "reserve"
    );
    printMarketStatus(market);
  };

  //10000 * TARGET_DECIMAL_MODIFIER; //modifier is fine it's the manipulated treasury that's fucked
  //reserveValue = collateral * (1 - (1 - targets / targetSupply)^ (1/reserveRatio)))
  const reserveValueOnSell = (targets: number, market: Market) => {
    let curveSupply = market.targetTokenSupply - market.preMine;
    let base = 1 - targets / curveSupply;
    let ex = 1 - Math.pow(base, 1 / market.reserveRatio);
    let whole = market.reserveBalance * ex;
    console.log("whole", whole);
    return whole;
  };

  const fillReserve = (market: Market, amount: number) => {
    console.log("");
    console.log("FILLING RESERVE");
    let oldMarginalPrice = marginalPrice(market);
    market.reserveBalance += amount;
    let newMarginalPrice = marginalPrice(market);
    console.log("marginal price change: ", newMarginalPrice - oldMarginalPrice);
    console.log(
      "% price change",
      ((newMarginalPrice - oldMarginalPrice) / oldMarginalPrice) * 100,
      "%"
    );
  };
  const printMarketStatus = (market: Market) => {
    console.log("MARKET STATUS ------");
    let status = {
      targetTokenSupply: market.targetTokenSupply,
      reserveBalance: market.reserveBalance,
      reserveRatio: market.reserveRatio,
      marginalPrice: marginalPrice(market),
    };
    console.log(status);
  };

  //treasury / (supply * reserveRatio) = price
  const marginalPrice = (market: Market) => {
    return (
      market.reserveBalance /
        ((market.targetTokenSupply - market.preMine) * market.reserveRatio) +
      market.initialPrice
    );
  };
});

/*
//pro-rata redemption doesn't move the price at all
  const redeem = (targets: number, market: Market, user: User) => {
    let prorata = targets / market.targetTokenSupply;
    console.log("");
    console.log("REDEEMING");
    console.log("targets redeemed:", targets);
    console.log("pro rata", prorata);
    let claim = prorata * market.reserveBalance;
    console.log("claim", claim);
    market.reserveBalance -= claim;
    market.targetTokenSupply -= targets;
    user.reserveTokenBalance += claim;
    user.targetTokenBalance -= targets;
    console.log("value per token: ", claim / targets, "reserve");
    printMarketStatus(market);
  };
 const getTargetsReceieved = (reservePaid: number, market: Market) => {
    let base = 1 + reservePaid / market.reserveBalance;
    // console.log("base");
    // console.log(base);
    let ex = Math.pow(base, market.reserveRatio) - 1;
    // console.log("ex");
    // console.log(ex);
    let whole = market.targetTokenSupply * ex;
    //console.log("whole");
    console.log("targets received: ", whole);
    return whole;
  };

  bancor-testing
MARKET STATUS ------
{
  targetTokenSupply: 11,
  reserveBalance: 0.5,
  reserveRatio: 0.5,
  marginalPrice: 1
}

BUYING
targets received: 99
reserve value on buy:  4999.5
decimal adjusted reserve value 0.0049995
price per token:  50.5 reserve
MARKET STATUS ------
{
  targetTokenSupply: 110,
  reserveBalance: 5000,
  reserveRatio: 0.5,
  marginalPrice: 100
}

FILLING RESERVE
marginal price change:  10
% price change 10 %








  bancor-testing
MARKET STATUS ------
{
  targetTokenSupply: 1000000,
  reserveBalance: 100000,
  reserveRatio: 0.5,
  marginalPrice: 0.2
}

BUYING
targets received: 100000
reserve value on buy:  21000.00000000002
price per token:  0.2100000000000002 reserve
MARKET STATUS ------
{
  targetTokenSupply: 1100000,
  reserveBalance: 121000.00000000001,
  reserveRatio: 0.5,
  marginalPrice: 0.22000000000000003
}

BUYING
targets received: 40000
reserve value on buy:  8960.00000000001
price per token:  0.22400000000000023 reserve
MARKET STATUS ------
{
  targetTokenSupply: 1140000,
  reserveBalance: 129960.00000000003,
  reserveRatio: 0.5,
  marginalPrice: 0.22800000000000006
}

BUYING
targets received: 80000
reserve value on buy:  18879.999999999996
price per token:  0.23599999999999996 reserve
MARKET STATUS ------
{
  targetTokenSupply: 1220000,
  reserveBalance: 148840.00000000003,
  reserveRatio: 0.5,
  marginalPrice: 0.24400000000000005
}

SELLING
targets sold: 80000
reserve value on sell:  18880
price per token:  0.236 reserve
MARKET STATUS ------
{
  targetTokenSupply: 1140000,
  reserveBalance: 129960.00000000003,
  reserveRatio: 0.5,
  marginalPrice: 0.22800000000000006
}

SELLING
targets sold: 40000
reserve value on sell:  8960.000000000004
price per token:  0.2240000000000001 reserve
MARKET STATUS ------
{
  targetTokenSupply: 1100000,
  reserveBalance: 121000.00000000003,
  reserveRatio: 0.5,
  marginalPrice: 0.22000000000000006
}

SELLING
targets sold: 100000
reserve value on sell:  21000.000000000015
price per token:  0.21000000000000016 reserve
MARKET STATUS ------
{
  targetTokenSupply: 1000000,
  reserveBalance: 100000.00000000001,
  reserveRatio: 0.5,
  marginalPrice: 0.20000000000000004
}
*/

/*

)
  
  "receive x target tokens and pay y reserve" -- this is same as sell amount from billy (billy is from curve POV)
  reserveValueOnBuy = collateral * ((1 + tokensSold / totalSupply)^(1/ReserveRatio) — 1)
  

  "give back x tokens and receive y reserves" -- this is same as saleReturn from yos
  reserveValueOnSell = collateral * (1 - (1 - tokensSold / tokenSupply) ^ (1 / ReserveRatio))


  i think the problem is billy is doing it from the perspective of the curve only
  and the other guy is flip flopping

  */

//buyAmt = tokenSupply * ((1 + amtPaid / collateral)^CW — 1)
//SaleReturn = ReserveTokenBalance * (1 - (1 - ContinuousTokensReceived / ContinuousTokenSupply) ^ (1 / (ReserveRatio)))
//derived from each
//PurchaseReturn = ContinuousTokenSupply * ((1 + ReserveTokensReceived / ReserveTokenBalance) ^ (ReserveRatio) - 1)

//    PurchaseReturn = ContinuousTokenSupply * ((1 + ReserveTokensReceived / ReserveTokenBalance) ^ (ReserveRatio) - 1)
// buyAmt = tokenSupply * ((1 + amtPaid / collateral)^CW — 1)
//target tokens returned
//this would go for a buy
//targetsReturned = targetSupply * ((1 + baseSpent / treasuryBalance)^RR - 1)

/*

-- derived from buy amt? switching places
  "pay y reserve and receive x target tokens"
  tokenValue = tokenSupply * ((1 + reservesPaid / collateral)^CW — 1

"receive x reserves and sell y tokens"
  reserveValue = collateral * ((1 + tokensSold / totalSupply)^(1/CW) — 1)
  const buyTarget = (reserveToSpend: number, market: Market, user: User) => {
    console.log("");
    console.log("BUYING");
    console.log("reserve given:", reserveToSpend);
    let targetsReceived = getTargetsReceieved(reserveToSpend, market);
    market.reserveBalance += reserveToSpend;
    market.targetTokenSupply += targetsReceived;
    user.reserveTokenBalance -= reserveToSpend;
    user.targetTokenBalance += targetsReceived;
    console.log(
      "price per token: ",
      reserveToSpend / targetsReceived,
      "reserve"
    );
    printMarketStatus(market);
  };
  //sellAmt = collateral * ((1 + tokensSold / totalSupply)^(1/CW) — 1)
  const getReserveReceived = (targetTokensSold: number, market: Market) => {
    let base = 1 - targetTokensSold / market.targetTokenSupply;
    let ex = 1 - Math.pow(base, 1 / market.reserveRatio);
    let whole = market.reserveBalance * ex;
    console.log("reserve received: ", whole);
    return whole;
  };
  const sellTarget = (targetsToGive: number, market: Market, user: User) => {
    console.log("");
    console.log("SELLING");
    console.log("targets given:", targetsToGive);
    let reserveReceived = getReserveReceived(targetsToGive, market);
    market.reserveBalance -= reserveReceived;
    market.targetTokenSupply -= targetsToGive;
    user.reserveTokenBalance += reserveReceived;
    user.targetTokenBalance -= targetsToGive;
    console.log(
      "price per token: ",
      reserveReceived / targetsToGive,
      "reserve"
    );
    printMarketStatus(market);
  };


MARKET STATUS ------
{
  targetTokenSupply: 10000,
  reserveBalance: 1000,
  reserveRatio: 0.5,
  marginalPrice: 0.2
}

BUYING
targets received: 1000
reserve value:  210.0000000000002
price per token:  0.2100000000000002 reserve
MARKET STATUS ------
{
  targetTokenSupply: 11000,
  reserveBalance: 1210.0000000000002,
  reserveRatio: 0.5,
  marginalPrice: 0.22000000000000003
}

BUYING
targets received: 400
reserve value:  89.60000000000011
price per token:  0.22400000000000028 reserve
MARKET STATUS ------
{
  targetTokenSupply: 11400,
  reserveBalance: 1299.6000000000004,
  reserveRatio: 0.5,
  marginalPrice: 0.22800000000000006
}

BUYING
targets received: 800
reserve value:  188.79999999999998
price per token:  0.236 reserve
MARKET STATUS ------
{
  targetTokenSupply: 12200,
  reserveBalance: 1488.4000000000003,
  reserveRatio: 0.5,
  marginalPrice: 0.24400000000000005
}

SELLING
targets given: 800
reserve received:  188.8
price per token:  0.23600000000000002 reserve
MARKET STATUS ------
{
  targetTokenSupply: 11400,
  reserveBalance: 1299.6000000000004,
  reserveRatio: 0.5,
  marginalPrice: 0.22800000000000006
}

SELLING
targets given: 400
reserve received:  89.60000000000004
price per token:  0.2240000000000001 reserve
MARKET STATUS ------
{
  targetTokenSupply: 11000,
  reserveBalance: 1210.0000000000002,
  reserveRatio: 0.5,
  marginalPrice: 0.22000000000000003
}
*/
