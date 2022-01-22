import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { BancorTesting } from "../target/types/bancor_testing";

describe("bancor-testing", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.BancorTesting as Program<BancorTesting>;

  // it('Is initialized!', async () => {
  //   // Add your test here.
  //   const tx = await program.rpc.initialize({});
  //   console.log("Your transaction signature", tx);
  // });

  interface Market {
    targetTokenSupply: number;
    reserveBalance: number;
    reserveRatio: number;
  }
  let market: Market = {
    targetTokenSupply: 10000,
    reserveBalance: 1000,
    reserveRatio: 0.5,
  };
  interface User {
    reserveTokenBalance: number;
    targetTokenBalance: number;
  }
  let user: User = {
    reserveTokenBalance: 100000,
    targetTokenBalance: 0,
  };

  it("testing", async () => {
    /*
    treasury / (supply * crr) = price
    //tokens received is tokens received by the curve

    //
    PurchaseReturn = ContinuousTokenSupply * ((1 + ReserveTokensReceived / ReserveTokenBalance) ^ (ReserveRatio) - 1)
    buyAmt = tokenSupply * ((1 + amtPaid / collateral)^CW — 1)

    //
    SaleReturn = ReserveTokenBalance * (1 - (1 - ContinuousTokensReceived / ContinuousTokenSupply) ^ (1 / (ReserveRatio)))
    */
    printMarketStatus(market);

    buyTarget(5000, market, user);
    buyTarget(5000, market, user);
    fillReserve(market, 250);
    //printMarketStatus(market);
    buyTarget(200, market, user);
    fillReserve(market, 350);
    sellTarget(300.15315780902193, market, user);
    sellTarget(120, market, user);
    sellTarget(120, market, user);
  });

  const fillReserve = (market: Market, amount: number) => {
    console.log("");
    console.log("FILLING RESERVE");
    let oldMarginalPrice = marginalPrice(market);
    market.reserveBalance += amount;
    let newMarginalPrice = marginalPrice(market);
    console.log("marginal price change: ", newMarginalPrice - oldMarginalPrice);
  };

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
  const marginalPrice = (market: Market) => {
    return (
      market.reserveBalance / (market.targetTokenSupply * market.reserveRatio)
    );
  };

  //    PurchaseReturn = ContinuousTokenSupply * ((1 + ReserveTokensReceived / ReserveTokenBalance) ^ (ReserveRatio) - 1)
  // buyAmt = tokenSupply * ((1 + amtPaid / collateral)^CW — 1)
  //target tokens returned
  //this would go for a buy
  //targetsReturned = targetSupply * ((1 + baseSpent / treasuryBalance)^RR - 1)
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

  //sellAmt = collateral * ((1 + tokensSold / totalSupply)^(1/CW) — 1)
  const getReserveReceived = (targetTokensSold: number, market: Market) => {
    let base = 1 - targetTokensSold / market.targetTokenSupply;
    let ex = 1 - Math.pow(base, 1 / market.reserveRatio);
    let whole = market.reserveBalance * ex;
    console.log("reserve received: ", whole);
    return whole;
  };
});
