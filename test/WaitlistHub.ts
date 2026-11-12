import { expect } from "chai";
import { ethers } from "hardhat";
import { WaitlistHub } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const Status = {
  None: 0n,
  Waiting: 1n,
  Called: 2n,
  Admitted: 3n,
  Left: 4n,
  Removed: 5n,
};

describe("WaitlistHub", function () {
  let hub: WaitlistHub;
  let organiser: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;
  let dave: HardhatEthersSigner;

  beforeEach(async function () {
    [organiser, alice, bob, carol, dave] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("WaitlistHub");
    hub = (await Factory.connect(organiser).deploy()) as WaitlistHub;
    await hub.waitForDeployment();
  });

  describe("Creation & Reading", function () {
    it("creates a waitlist with valid name and capacity and emits WaitlistCreated", async function () {
      await expect(hub.connect(organiser).createWaitlist("Launch Party", 3))
        .to.emit(hub, "WaitlistCreated")
        .withArgs(1n, organiser.address, "Launch Party", 3);

      expect(await hub.waitlistCount()).to.equal(1n);

      const wl = await hub.getWaitlist(1);
      expect(wl.id).to.equal(1n);
      expect(wl.organiser).to.equal(organiser.address);
      expect(wl.name).to.equal("Launch Party");
      expect(wl.isOpen).to.equal(true);
      expect(wl.maxCapacity).to.equal(3n);
      expect(wl.activeCount).to.equal(0n);
      expect(wl.waitingCount).to.equal(0n);
      expect(wl.calledCount).to.equal(0n);
      expect(wl.admittedCount).to.equal(0n);
      expect(wl.totalEntries).to.equal(0n);
    });

    it("rejects empty name, overly long name, or zero capacity", async function () {
      await expect(
        hub.connect(organiser).createWaitlist("", 5)
      ).to.be.revertedWithCustomError(hub, "EmptyName");

      await expect(
        hub.connect(organiser).createWaitlist("a".repeat(129), 5)
      ).to.be.revertedWithCustomError(hub, "NameTooLong");

      await expect(
        hub.connect(organiser).createWaitlist("Zero Cap", 0)
      ).to.be.revertedWithCustomError(hub, "InvalidCapacity");
    });
  });

  describe("FCFS Queue, Positions & Access Control", function () {
    beforeEach(async function () {
      await hub.connect(organiser).createWaitlist("VIP Access", 3);
    });

    it("assigns FCFS positions across multiple wallets and updates dynamically", async function () {
      await expect(hub.connect(alice).joinWaitlist(1))
        .to.emit(hub, "UserJoined")
        .withArgs(1n, 1n, alice.address, false);
      await hub.connect(bob).joinWaitlist(1);
      await hub.connect(carol).joinWaitlist(1);

      expect((await hub.connect(alice).getMyPosition(1)).position).to.equal(1n);
      expect((await hub.connect(bob).getMyPosition(1)).position).to.equal(2n);
      expect((await hub.connect(carol).getMyPosition(1)).position).to.equal(3n);

      // Middle user Bob leaves -> Carol shifts from 3 to 2
      await expect(hub.connect(bob).leaveWaitlist(1))
        .to.emit(hub, "UserLeft")
        .withArgs(1n, 2n, bob.address);

      expect((await hub.connect(alice).getMyPosition(1)).position).to.equal(1n);
      expect((await hub.connect(bob).getMyPosition(1)).position).to.equal(0n);
      expect((await hub.connect(bob).getMyPosition(1)).status).to.equal(Status.Left);
      expect((await hub.connect(carol).getMyPosition(1)).position).to.equal(2n);

      // Organiser calls next -> Alice is called (entryId 1), Carol becomes #1
      await expect(hub.connect(organiser).callNext(1))
        .to.emit(hub, "UserCalled")
        .withArgs(1n, 1n, alice.address);

      expect((await hub.connect(alice).getMyPosition(1)).status).to.equal(Status.Called);
      expect((await hub.connect(alice).getMyPosition(1)).position).to.equal(0n);
      expect((await hub.connect(carol).getMyPosition(1)).position).to.equal(1n);

      // Organiser admits Alice
      await expect(hub.connect(organiser).admitUser(1, alice.address))
        .to.emit(hub, "UserAdmitted")
        .withArgs(1n, 1n, alice.address);
    });

    it("restricts organiser actions strictly to the waitlist creator", async function () {
      await hub.connect(alice).joinWaitlist(1);

      await expect(
        hub.connect(alice).callNext(1)
      ).to.be.revertedWithCustomError(hub, "NotOrganiser");

      await expect(
        hub.connect(bob).admitUser(1, alice.address)
      ).to.be.revertedWithCustomError(hub, "NotOrganiser");

      await expect(
        hub.connect(bob).removeUser(1, alice.address)
      ).to.be.revertedWithCustomError(hub, "NotOrganiser");

      await expect(
        hub.connect(bob).closeWaitlist(1)
      ).to.be.revertedWithCustomError(hub, "NotOrganiser");
    });
  });

  describe("Capacity Rules (Waiting + Called + Admitted)", function () {
    beforeEach(async function () {
      await hub.connect(organiser).createWaitlist("Cap2", 2);
    });

    it("counts Waiting, Called, and Admitted toward activeCount and blocks full joins", async function () {
      await hub.connect(alice).joinWaitlist(1);
      await hub.connect(bob).joinWaitlist(1);

      await expect(
        hub.connect(carol).joinWaitlist(1)
      ).to.be.revertedWithCustomError(hub, "WaitlistFull");

      // Call Alice -> Called still counts toward capacity
      await hub.connect(organiser).callNext(1);
      let wl = await hub.getWaitlist(1);
      expect(wl.activeCount).to.equal(2n);
      await expect(
        hub.connect(carol).joinWaitlist(1)
      ).to.be.revertedWithCustomError(hub, "WaitlistFull");

      // Admit Alice -> Admitted still counts toward capacity
      await hub.connect(organiser).admitUser(1, alice.address);
      wl = await hub.getWaitlist(1);
      expect(wl.activeCount).to.equal(2n);
      expect(wl.admittedCount).to.equal(1n);
      await expect(
        hub.connect(carol).joinWaitlist(1)
      ).to.be.revertedWithCustomError(hub, "WaitlistFull");

      // Bob leaves -> frees 1 spot immediately so Carol can join
      await hub.connect(bob).leaveWaitlist(1);
      wl = await hub.getWaitlist(1);
      expect(wl.activeCount).to.equal(1n);

      await hub.connect(carol).joinWaitlist(1);
      wl = await hub.getWaitlist(1);
      expect(wl.activeCount).to.equal(2n);
    });
  });

  describe("Re-joining & Historical Entry Preservation", function () {
    beforeEach(async function () {
      await hub.connect(organiser).createWaitlist("Rejoin Test", 5);
    });

    it("blocks duplicate active joins (Waiting, Called, Admitted)", async function () {
      await hub.connect(alice).joinWaitlist(1);
      await expect(
        hub.connect(alice).joinWaitlist(1)
      ).to.be.revertedWithCustomError(hub, "AlreadyActiveOrAdmitted");

      await hub.connect(organiser).callNext(1);
      await expect(
        hub.connect(alice).joinWaitlist(1)
      ).to.be.revertedWithCustomError(hub, "AlreadyActiveOrAdmitted");

      await hub.connect(organiser).admitUser(1, alice.address);
      await expect(
        hub.connect(alice).joinWaitlist(1)
      ).to.be.revertedWithCustomError(hub, "AlreadyActiveOrAdmitted");
    });

    it("allows Left wallet to rejoin with a new entryId at back of queue while preserving history", async function () {
      await hub.connect(alice).joinWaitlist(1); // entryId 1
      await hub.connect(bob).joinWaitlist(1);   // entryId 2

      await hub.connect(alice).leaveWaitlist(1);
      expect((await hub.getWaitlist(1)).activeCount).to.equal(1n);

      // Rejoin creates entryId 3 and puts Alice behind Bob
      await expect(hub.connect(alice).joinWaitlist(1))
        .to.emit(hub, "UserJoined")
        .withArgs(1n, 3n, alice.address, true)
        .and.to.emit(hub, "UserRejoined")
        .withArgs(1n, 3n, 1n, alice.address);

      const wl = await hub.getWaitlist(1);
      expect(wl.activeCount).to.equal(2n); // old Left entry does NOT count!
      expect(wl.waitingCount).to.equal(2n);
      expect(wl.totalEntries).to.equal(3n);

      expect((await hub.connect(bob).getMyPosition(1)).position).to.equal(1n);
      const alicePos = await hub.connect(alice).getMyPosition(1);
      expect(alicePos.position).to.equal(2n);
      expect(alicePos.entryId).to.equal(3n);

      const [entries] = await hub.getWaitlistEntries(1, 0, 10);
      expect(entries.length).to.equal(3);
      expect(entries[0].entryId).to.equal(1n);
      expect(entries[0].wallet).to.equal(alice.address);
      expect(entries[0].status).to.equal(Status.Left);

      expect(entries[2].entryId).to.equal(3n);
      expect(entries[2].wallet).to.equal(alice.address);
      expect(entries[2].status).to.equal(Status.Waiting);
    });

    it("allows a Called user to leave before admission and rejoin later", async function () {
      await hub.connect(alice).joinWaitlist(1);
      await hub.connect(organiser).callNext(1);
      await hub.connect(alice).leaveWaitlist(1);

      expect((await hub.getWaitlist(1)).activeCount).to.equal(0n);
      await hub.connect(alice).joinWaitlist(1);
      expect((await hub.getWaitlist(1)).activeCount).to.equal(1n);
    });
  });

  describe("Remove User (Waiting, Called, Admitted) & Prevent Re-admission/Rejoin", function () {
    beforeEach(async function () {
      await hub.connect(organiser).createWaitlist("Removals", 2);
    });

    it("removes Waiting, Called, and Admitted participants, frees capacity, preserves history, and blocks rejoining", async function () {
      await hub.connect(alice).joinWaitlist(1); // entry 1
      await hub.connect(bob).joinWaitlist(1);   // entry 2

      // Remove Waiting user Bob
      await expect(hub.connect(organiser).removeUser(1, bob.address))
        .to.emit(hub, "UserRemoved")
        .withArgs(1n, 2n, bob.address, Status.Waiting);

      expect((await hub.getWaitlist(1)).activeCount).to.equal(1n);
      await expect(
        hub.connect(bob).joinWaitlist(1)
      ).to.be.revertedWithCustomError(hub, "RemovedUserCannotRejoin");

      // Carol joins -> Call Carol -> Remove Called user Carol
      await hub.connect(carol).joinWaitlist(1); // entry 3
      await hub.connect(organiser).callNext(1); // calls Alice (head)
      await hub.connect(organiser).callNext(1); // calls Carol

      await expect(hub.connect(organiser).removeUser(1, carol.address))
        .to.emit(hub, "UserRemoved")
        .withArgs(1n, 3n, carol.address, Status.Called);

      expect((await hub.getWaitlist(1)).activeCount).to.equal(1n);
      await expect(
        hub.connect(carol).joinWaitlist(1)
      ).to.be.revertedWithCustomError(hub, "RemovedUserCannotRejoin");

      // Admit Alice -> capacity is 1/2 -> Dave joins (2/2 full) -> Remove Admitted Alice -> frees spot
      await hub.connect(organiser).admitUser(1, alice.address);
      await hub.connect(dave).joinWaitlist(1); // entry 4
      expect((await hub.getWaitlist(1)).activeCount).to.equal(2n);

      await expect(hub.connect(organiser).removeUser(1, alice.address))
        .to.emit(hub, "UserRemoved")
        .withArgs(1n, 1n, alice.address, Status.Admitted);

      const wl = await hub.getWaitlist(1);
      expect(wl.activeCount).to.equal(1n);
      expect(wl.admittedCount).to.equal(0n);

      // Alice cannot rejoin or be re-admitted
      await expect(
        hub.connect(alice).joinWaitlist(1)
      ).to.be.revertedWithCustomError(hub, "RemovedUserCannotRejoin");
      await expect(
        hub.connect(organiser).admitUser(1, alice.address)
      ).to.be.revertedWithCustomError(hub, "CannotAdmitUser");

      // Cannot remove already Removed or Left user
      await expect(
        hub.connect(organiser).removeUser(1, alice.address)
      ).to.be.revertedWithCustomError(hub, "CannotRemoveUser");

      await hub.connect(dave).leaveWaitlist(1);
      await expect(
        hub.connect(organiser).removeUser(1, dave.address)
      ).to.be.revertedWithCustomError(hub, "CannotRemoveUser");

      // Historical entries remain intact
      const [entries] = await hub.getWaitlistEntries(1, 0, 10);
      expect(entries.length).to.equal(4);
      expect(entries[0].status).to.equal(Status.Removed);
      expect(entries[1].status).to.equal(Status.Removed);
      expect(entries[2].status).to.equal(Status.Removed);
      expect(entries[3].status).to.equal(Status.Left);
    });

    it("prevents admitting an already admitted user or leaving after admission", async function () {
      await hub.connect(alice).joinWaitlist(1);
      await hub.connect(organiser).admitUser(1, alice.address);

      await expect(
        hub.connect(organiser).admitUser(1, alice.address)
      ).to.be.revertedWithCustomError(hub, "CannotAdmitUser");

      await expect(
        hub.connect(alice).leaveWaitlist(1)
      ).to.be.revertedWithCustomError(hub, "CannotLeaveAfterAdmissionOrExit");
    });
  });

  describe("Closing Waitlist", function () {
    it("prevents new joins after closeWaitlist while allowing existing queue processing", async function () {
      await hub.connect(organiser).createWaitlist("Closing Soon", 5);
      await hub.connect(alice).joinWaitlist(1);

      await expect(hub.connect(organiser).closeWaitlist(1))
        .to.emit(hub, "WaitlistClosed")
        .withArgs(1n, organiser.address);

      await expect(
        hub.connect(organiser).closeWaitlist(1)
      ).to.be.revertedWithCustomError(hub, "WaitlistAlreadyClosed");

      await expect(
        hub.connect(bob).joinWaitlist(1)
      ).to.be.revertedWithCustomError(hub, "WaitlistIsClosed");

      // Existing participant can still be called & admitted or leave
      await hub.connect(organiser).callNext(1);
      await hub.connect(organiser).admitUser(1, alice.address);
      expect((await hub.getWaitlist(1)).admittedCount).to.equal(1n);
    });
  });

  describe("Doubly-Linked List Edge Cases & Pagination", function () {
    it("handles head, middle, and tail removals/leaves and paginates waitlists & entries", async function () {
      await hub.connect(organiser).createWaitlist("WL 1", 10);
      await hub.connect(organiser).createWaitlist("WL 2", 10);

      const [page1, totalWl] = await hub.getWaitlists(0, 1);
      expect(totalWl).to.equal(2n);
      expect(page1.length).to.equal(1);
      expect(page1[0].name).to.equal("WL 1");

      const [page2] = await hub.getWaitlists(1, 5);
      expect(page2.length).to.equal(1);
      expect(page2[0].name).to.equal("WL 2");

      // Join 4 users on WL 1: alice (#1), bob (#2), carol (#3), dave (#4)
      await hub.connect(alice).joinWaitlist(1);
      await hub.connect(bob).joinWaitlist(1);
      await hub.connect(carol).joinWaitlist(1);
      await hub.connect(dave).joinWaitlist(1);

      // Leave head (alice), remove tail (dave), leave middle (bob) -> only carol remains (#1)
      await hub.connect(alice).leaveWaitlist(1);
      await hub.connect(organiser).removeUser(1, dave.address);
      await hub.connect(bob).leaveWaitlist(1);

      const carolPos = await hub.getUserPosition(1, carol.address);
      expect(carolPos.position).to.equal(1n);

      // Rejoin alice & bob -> order should be carol (#1), alice (#2), bob (#3)
      await hub.connect(alice).joinWaitlist(1);
      await hub.connect(bob).joinWaitlist(1);

      expect((await hub.getUserPosition(1, carol.address)).position).to.equal(1n);
      expect((await hub.getUserPosition(1, alice.address)).position).to.equal(2n);
      expect((await hub.getUserPosition(1, bob.address)).position).to.equal(3n);

      // callNext must call carol, then alice, then bob
      await expect(hub.connect(organiser).callNext(1))
        .to.emit(hub, "UserCalled")
        .withArgs(1n, 3n, carol.address);
      await expect(hub.connect(organiser).callNext(1))
        .to.emit(hub, "UserCalled")
        .withArgs(1n, 5n, alice.address);
      await expect(hub.connect(organiser).callNext(1))
        .to.emit(hub, "UserCalled")
        .withArgs(1n, 6n, bob.address);

      const [entriesPage, totalEntries] = await hub.getWaitlistEntries(1, 2, 3);
      expect(totalEntries).to.equal(6n);
      expect(entriesPage.length).to.equal(3);
      expect(entriesPage[0].entryId).to.equal(3n);
    });
  });

  describe("Gas Efficiency", function () {
    it("keeps state-changing operations O(1) and low gas", async function () {
      const createRc = await (await hub.connect(organiser).createWaitlist("Gas Check", 50)).wait();
      const join1Rc = await (await hub.connect(alice).joinWaitlist(1)).wait();
      const join2Rc = await (await hub.connect(bob).joinWaitlist(1)).wait();
      const leaveRc = await (await hub.connect(bob).leaveWaitlist(1)).wait();
      const rejoinRc = await (await hub.connect(bob).joinWaitlist(1)).wait();
      const callRc = await (await hub.connect(organiser).callNext(1)).wait();
      const admitRc = await (await hub.connect(organiser).admitUser(1, alice.address)).wait();
      const removeRc = await (await hub.connect(organiser).removeUser(1, alice.address)).wait();
      const closeRc = await (await hub.connect(organiser).closeWaitlist(1)).wait();

      expect(createRc!.gasUsed).to.be.lessThan(160_000n);
      expect(join1Rc!.gasUsed).to.be.lessThan(130_000n);
      expect(join2Rc!.gasUsed).to.be.lessThan(110_000n);
      expect(leaveRc!.gasUsed).to.be.lessThan(70_000n);
      expect(rejoinRc!.gasUsed).to.be.lessThan(110_000n);
      expect(callRc!.gasUsed).to.be.lessThan(80_000n);
      expect(admitRc!.gasUsed).to.be.lessThan(60_000n);
      expect(removeRc!.gasUsed).to.be.lessThan(60_000n);
      expect(closeRc!.gasUsed).to.be.lessThan(50_000n);

      console.log("      Gas used:", {
        createWaitlist: createRc!.gasUsed.toString(),
        firstJoin: join1Rc!.gasUsed.toString(),
        nextJoin: join2Rc!.gasUsed.toString(),
        leaveWaitlist: leaveRc!.gasUsed.toString(),
        rejoinWaitlist: rejoinRc!.gasUsed.toString(),
        callNext: callRc!.gasUsed.toString(),
        admitUser: admitRc!.gasUsed.toString(),
        removeUser: removeRc!.gasUsed.toString(),
        closeWaitlist: closeRc!.gasUsed.toString(),
      });
    });
  });
});
