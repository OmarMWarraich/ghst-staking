import { Contract } from "@ethersproject/contracts";
import { impersonate, maticStakingAddress } from "../scripts/helperFunctions";
import { IERC20, StakingFacet } from "../typechain";
import { expect } from "chai";
import { network } from "hardhat";
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers } from "hardhat";

// const { ethers } = require("hardhat");
const { upgrade } = require("../scripts/upgrades/upgrade-epoch.ts");

interface PoolObject {
  _poolAddress: string;
  _poolReceiptToken: string;
  _rate: BigNumberish;
  _poolName: string;
}

const testAddress = "0x027Ffd3c119567e85998f4E6B9c3d83D5702660c";
let owner: string, signer: Signer, stakingFacet: StakingFacet;

describe("Epoch Tests (Other Tokens)", async function () {
  const diamondAddress = maticStakingAddress;

  before(async function () {
    this.timeout(2000000000);
    await upgrade();

    owner = await (
      await ethers.getContractAt("OwnershipFacet", diamondAddress)
    ).owner();
    signer = await ethers.provider.getSigner(owner);

    stakingFacet = (await ethers.getContractAt(
      "StakingFacet",
      diamondAddress
    )) as StakingFacet;
  });

  it("Can initiate epoch", async function () {
    const pools: PoolObject[] = [
      {
        _poolAddress: "0x385Eeac5cB85A38A9a07A70c73e0a3271CfB54A7",
        _poolReceiptToken: ethers.constants.AddressZero,
        _rate: "1",
        _poolName: "GHST",
      },
      {
        _poolAddress: "0x8b1fd78ad67c7da09b682c5392b65ca7caa101b9",
        _poolReceiptToken: "0xA02d547512Bb90002807499F05495Fe9C4C3943f",
        _rate: "83",
        _poolName: "GHST-QUICK",
      },
      {
        _poolAddress: "0x096c5ccb33cfc5732bcd1f3195c13dbefc4c82f4",
        _poolReceiptToken: "0x04439eC4ba8b09acfae0E9b5D75A82cC63b19f09",
        _rate: "74000000",
        _poolName: "GHST-USDC",
      },
      {
        _poolAddress: "0xccb9d2100037f1253e6c1682adf7dc9944498aff",
        _poolReceiptToken: "0x388E2a3d389F27504212030c2D42Abf0a8188cd1",
        _rate: "12000000",
        _poolName: "GHST-WETH",
      },
    ];

    await stakingFacet.initiateEpoch(pools);

    const currentEpoch = await stakingFacet.currentEpoch();
    expect(currentEpoch).to.equal("0");
  });

  /*
  it("Should have a balance of stkGHST-QUICK before withdrawing", async function () {
    let stakedPools = await stakingFacet.stakedInCurrentEpoch(testAddress2);

    let frens = await stakingFacet.frens(testAddress2);
    console.log("frens:", frens.toString());
    let epochFrens = await stakingFacet.epochFrens(testAddress2);
    console.log("epoch:", epochFrens.toString());

    const currentEpoch = await stakingFacet.currentEpoch();
    const ghstQUICK = stakedPools[1];
    const poolInfo = await stakingFacet.getPoolInfo(
      ghstQUICK.poolAddress,
      currentEpoch
    );
    const stkGHSTQUICK = (await ethers.getContractAt(
      "ERC20",
      poolInfo._poolReceiptToken
    )) as IERC20;
    const balance = await stkGHSTQUICK.balanceOf(testAddress2);
    console.log("stkGHST-QUICK balance:", balance.toString());
    expect(balance).to.equal(ghstQUICK.amount);
  });
  */

  it("Unmigrated account can withdraw and automatically migrate", async function () {
    stakingFacet = await impersonate(
      testAddress,
      stakingFacet,
      ethers,
      network
    );

    let stakedPools = await stakingFacet.stakedInCurrentEpoch(testAddress);

    let frens = await stakingFacet.frens(testAddress);
    console.log("frens:", frens.toString());
    let epochFrens = await stakingFacet.epochFrens(testAddress);
    console.log("epoch:", epochFrens.toString());

    for (let index = 0; index < stakedPools.length; index++) {
      const pool = stakedPools[index];

      console.log("index:", index);

      //Withdraw GHST-QUICK
      await stakingFacet.withdrawFromPool(pool.poolAddress, pool.amount);
    }

    stakedPools = await stakingFacet.stakedInCurrentEpoch(testAddress);

    for (let index = 0; index < stakedPools.length; index++) {
      const pool = stakedPools[index];
      if (pool.poolName !== "GHST") {
        expect(pool.amount).to.equal(0);
      }
    }

    frens = await stakingFacet.frens(testAddress);
    console.log("frens after:", frens.toString());
    epochFrens = await stakingFacet.epochFrens(testAddress);
    console.log("epoch after:", epochFrens.toString());

    const hasMigrated = await stakingFacet.hasMigrated(testAddress);
    expect(hasMigrated).to.equal(true);
  });
  it("Balance of receipt tokens should be zero after withdrawing", async function () {
    let stakedPools = await stakingFacet.stakedInCurrentEpoch(testAddress);
    const currentEpoch = await stakingFacet.currentEpoch();
    const ghstQUICK = stakedPools[1];
    const poolInfo = await stakingFacet.getPoolInfo(
      ghstQUICK.poolAddress,
      currentEpoch
    );
    const stkGHSTQUICK = (await ethers.getContractAt(
      "ERC20",
      poolInfo._poolReceiptToken
    )) as IERC20;
    const balance = await stkGHSTQUICK.balanceOf(testAddress);
    expect(balance).to.equal(0);
  });

  it("Should stop receiving FRENS after withdrawing from pool", async function () {
    const epochFrensBefore = await stakingFacet.epochFrens(testAddress);
    // console.log("before:", epochFrensBefore);
    ethers.provider.send("evm_increaseTime", [86400 * 3]);
    ethers.provider.send("evm_mine", []);
    const epochFrensAfter = await stakingFacet.epochFrens(testAddress);
    expect(epochFrensBefore).to.equal(epochFrensAfter);
  });
});
