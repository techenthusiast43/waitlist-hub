// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title WaitlistHub
 * @notice Gas-efficient FCFS digital waitlist manager for BOT Chain.
 * @dev Uses packed structs and an O(1) doubly-linked waiting queue per waitlist
 *      while preserving all historical entries by monotonically increasing entryId.
 */
contract WaitlistHub {
    enum Status {
        None,
        Waiting,
        Called,
        Admitted,
        Left,
        Removed
    }

    struct Waitlist {
        address organiser;
        bool isOpen;
        uint32 maxCapacity;
        uint32 activeCount;
        uint32 waitingCount;
        uint32 calledCount;
        uint32 admittedCount;
        uint32 nextEntryId;
        uint32 waitingHead;
        uint32 waitingTail;
        string name;
    }

    struct Entry {
        address wallet;
        Status status;
        uint32 prevWaiting;
        uint32 nextWaiting;
    }

    struct WaitlistView {
        uint256 id;
        address organiser;
        string name;
        bool isOpen;
        uint32 maxCapacity;
        uint32 activeCount;
        uint32 waitingCount;
        uint32 calledCount;
        uint32 admittedCount;
        uint32 totalEntries;
    }

    struct EntryView {
        uint32 entryId;
        address wallet;
        Status status;
    }

    uint256 public waitlistCount;

    mapping(uint256 => Waitlist) private waitlists;
    mapping(uint256 => mapping(uint32 => Entry)) private entries;
    mapping(uint256 => mapping(address => uint32)) private latestEntryId;

    event WaitlistCreated(
        uint256 indexed waitlistId,
        address indexed organiser,
        string name,
        uint32 maxCapacity
    );
    event UserJoined(
        uint256 indexed waitlistId,
        uint32 indexed entryId,
        address indexed user,
        bool isRejoin
    );
    event UserRejoined(
        uint256 indexed waitlistId,
        uint32 indexed entryId,
        uint32 indexed previousEntryId,
        address user
    );
    event UserLeft(
        uint256 indexed waitlistId,
        uint32 indexed entryId,
        address indexed user
    );
    event UserCalled(
        uint256 indexed waitlistId,
        uint32 indexed entryId,
        address indexed user
    );
    event UserAdmitted(
        uint256 indexed waitlistId,
        uint32 indexed entryId,
        address indexed user
    );
    event UserRemoved(
        uint256 indexed waitlistId,
        uint32 indexed entryId,
        address indexed user,
        Status previousStatus
    );
    event WaitlistClosed(
        uint256 indexed waitlistId,
        address indexed organiser
    );

    error EmptyName();
    error NameTooLong();
    error InvalidCapacity();
    error WaitlistNotFound();
    error NotOrganiser();
    error WaitlistIsClosed();
    error WaitlistAlreadyClosed();
    error WaitlistFull();
    error AlreadyActiveOrAdmitted();
    error RemovedUserCannotRejoin();
    error NotInWaitlist();
    error CannotLeaveAfterAdmissionOrExit(Status currentStatus);
    error NoWaitingParticipants();
    error UserNotInWaitlist();
    error CannotAdmitUser(Status currentStatus);
    error CannotRemoveUser(Status currentStatus);

    /**
     * @notice Create a new open waitlist with a name and active capacity limit.
     * @param name Display name of the waitlist (1 to 128 bytes).
     * @param maxCapacity Maximum simultaneous active participants (Waiting + Called + Admitted).
     */
    function createWaitlist(
        string calldata name,
        uint256 maxCapacity
    ) external returns (uint256 waitlistId) {
        uint256 nameLen = bytes(name).length;
        if (nameLen == 0) revert EmptyName();
        if (nameLen > 128) revert NameTooLong();
        if (maxCapacity == 0 || maxCapacity > type(uint32).max) {
            revert InvalidCapacity();
        }

        waitlistId = ++waitlistCount;
        Waitlist storage w = waitlists[waitlistId];
        w.organiser = msg.sender;
        w.isOpen = true;
        w.maxCapacity = uint32(maxCapacity);
        w.nextEntryId = 1;
        w.name = name;

        emit WaitlistCreated(waitlistId, msg.sender, name, uint32(maxCapacity));
    }

    /**
     * @notice Join an open waitlist or rejoin after previously leaving voluntarily.
     * @param waitlistId Target waitlist identifier.
     */
    function joinWaitlist(uint256 waitlistId) external {
        Waitlist storage w = _requireWaitlist(waitlistId);
        if (!w.isOpen) revert WaitlistIsClosed();
        if (w.activeCount >= w.maxCapacity) revert WaitlistFull();

        uint32 prevEntryId = latestEntryId[waitlistId][msg.sender];
        bool isRejoin;
        if (prevEntryId != 0) {
            Status prevStatus = entries[waitlistId][prevEntryId].status;
            if (prevStatus == Status.Removed) {
                revert RemovedUserCannotRejoin();
            }
            if (
                prevStatus == Status.Waiting ||
                prevStatus == Status.Called ||
                prevStatus == Status.Admitted
            ) {
                revert AlreadyActiveOrAdmitted();
            }
            isRejoin = true;
        }

        uint32 entryId = w.nextEntryId;
        w.nextEntryId = entryId + 1;

        uint32 prevTail = w.waitingTail;
        if (prevTail == 0) {
            w.waitingHead = entryId;
            w.waitingTail = entryId;
        } else {
            entries[waitlistId][prevTail].nextWaiting = entryId;
            w.waitingTail = entryId;
        }

        entries[waitlistId][entryId] = Entry({
            wallet: msg.sender,
            status: Status.Waiting,
            prevWaiting: prevTail,
            nextWaiting: 0
        });

        latestEntryId[waitlistId][msg.sender] = entryId;
        w.activeCount += 1;
        w.waitingCount += 1;

        emit UserJoined(waitlistId, entryId, msg.sender, isRejoin);
        if (isRejoin) {
            emit UserRejoined(waitlistId, entryId, prevEntryId, msg.sender);
        }
    }

    /**
     * @notice Leave a waitlist prior to admission (Waiting or Called).
     * @param waitlistId Target waitlist identifier.
     */
    function leaveWaitlist(uint256 waitlistId) external {
        Waitlist storage w = _requireWaitlist(waitlistId);
        uint32 entryId = latestEntryId[waitlistId][msg.sender];
        if (entryId == 0) revert NotInWaitlist();

        Entry storage e = entries[waitlistId][entryId];
        Status currentStatus = e.status;
        if (
            currentStatus != Status.Waiting &&
            currentStatus != Status.Called
        ) {
            revert CannotLeaveAfterAdmissionOrExit(currentStatus);
        }

        if (currentStatus == Status.Waiting) {
            _unlinkWaiting(w, waitlistId, e);
            w.waitingCount -= 1;
        } else {
            w.calledCount -= 1;
        }

        e.status = Status.Left;
        w.activeCount -= 1;

        emit UserLeft(waitlistId, entryId, msg.sender);
    }

    /**
     * @notice Organiser calls the next waiting participant in strict FCFS order.
     * @param waitlistId Target waitlist identifier.
     */
    function callNext(
        uint256 waitlistId
    ) external returns (uint256 entryId, address participant) {
        Waitlist storage w = _requireOrganiser(waitlistId);
        uint32 headId = w.waitingHead;
        if (headId == 0) revert NoWaitingParticipants();

        Entry storage e = entries[waitlistId][headId];
        _unlinkWaiting(w, waitlistId, e);
        w.waitingCount -= 1;
        w.calledCount += 1;
        e.status = Status.Called;

        participant = e.wallet;
        entryId = headId;

        emit UserCalled(waitlistId, headId, participant);
    }

    /**
     * @notice Organiser marks a Waiting or Called participant as Admitted.
     * @param waitlistId Target waitlist identifier.
     * @param user Participant wallet address.
     */
    function admitUser(uint256 waitlistId, address user) external {
        Waitlist storage w = _requireOrganiser(waitlistId);
        uint32 entryId = latestEntryId[waitlistId][user];
        if (entryId == 0) revert UserNotInWaitlist();

        Entry storage e = entries[waitlistId][entryId];
        Status currentStatus = e.status;
        if (
            currentStatus != Status.Waiting &&
            currentStatus != Status.Called
        ) {
            revert CannotAdmitUser(currentStatus);
        }

        if (currentStatus == Status.Waiting) {
            _unlinkWaiting(w, waitlistId, e);
            w.waitingCount -= 1;
        } else {
            w.calledCount -= 1;
        }

        e.status = Status.Admitted;
        w.admittedCount += 1;

        emit UserAdmitted(waitlistId, entryId, user);
    }

    /**
     * @notice Organiser removes a Waiting, Called, or Admitted participant.
     * @dev Frees one active capacity spot immediately and prevents rejoining.
     * @param waitlistId Target waitlist identifier.
     * @param user Participant wallet address.
     */
    function removeUser(uint256 waitlistId, address user) external {
        Waitlist storage w = _requireOrganiser(waitlistId);
        uint32 entryId = latestEntryId[waitlistId][user];
        if (entryId == 0) revert UserNotInWaitlist();

        Entry storage e = entries[waitlistId][entryId];
        Status currentStatus = e.status;
        if (
            currentStatus != Status.Waiting &&
            currentStatus != Status.Called &&
            currentStatus != Status.Admitted
        ) {
            revert CannotRemoveUser(currentStatus);
        }

        if (currentStatus == Status.Waiting) {
            _unlinkWaiting(w, waitlistId, e);
            w.waitingCount -= 1;
        } else if (currentStatus == Status.Called) {
            w.calledCount -= 1;
        } else {
            w.admittedCount -= 1;
        }

        e.status = Status.Removed;
        w.activeCount -= 1;

        emit UserRemoved(waitlistId, entryId, user, currentStatus);
    }

    /**
     * @notice Organiser closes the waitlist so no further joins are accepted.
     * @param waitlistId Target waitlist identifier.
     */
    function closeWaitlist(uint256 waitlistId) external {
        Waitlist storage w = _requireOrganiser(waitlistId);
        if (!w.isOpen) revert WaitlistAlreadyClosed();

        w.isOpen = false;
        emit WaitlistClosed(waitlistId, msg.sender);
    }

    /**
     * @notice Retrieve full details for a single waitlist.
     */
    function getWaitlist(
        uint256 waitlistId
    ) external view returns (WaitlistView memory) {
        Waitlist storage w = _requireWaitlist(waitlistId);
        return _toWaitlistView(waitlistId, w);
    }

    /**
     * @notice Retrieve the caller's queue position (1-based if Waiting, 0 otherwise), status, and latest entry ID.
     */
    function getMyPosition(
        uint256 waitlistId
    ) external view returns (uint256 position, Status status, uint32 entryId) {
        return _getPosition(waitlistId, msg.sender);
    }

    /**
     * @notice Retrieve any wallet's queue position (1-based if Waiting, 0 otherwise), status, and latest entry ID.
     */
    function getUserPosition(
        uint256 waitlistId,
        address user
    ) external view returns (uint256 position, Status status, uint32 entryId) {
        return _getPosition(waitlistId, user);
    }

    /**
     * @notice Paginated list of waitlists (1-indexed waitlist IDs, offset 0-based).
     */
    function getWaitlists(
        uint256 offset,
        uint256 limit
    ) external view returns (WaitlistView[] memory items, uint256 total) {
        total = waitlistCount;
        if (offset >= total || limit == 0) {
            return (new WaitlistView[](0), total);
        }

        uint256 remaining = total - offset;
        uint256 count = limit < remaining ? limit : remaining;
        items = new WaitlistView[](count);

        for (uint256 i = 0; i < count; ) {
            uint256 id = offset + i + 1;
            items[i] = _toWaitlistView(id, waitlists[id]);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Paginated list of all entries (active and historical) for a waitlist.
     */
    function getWaitlistEntries(
        uint256 waitlistId,
        uint256 offset,
        uint256 limit
    ) external view returns (EntryView[] memory items, uint32 totalEntries) {
        Waitlist storage w = _requireWaitlist(waitlistId);
        totalEntries = w.nextEntryId - 1;
        if (offset >= totalEntries || limit == 0) {
            return (new EntryView[](0), totalEntries);
        }

        uint256 remaining = totalEntries - offset;
        uint256 count = limit < remaining ? limit : remaining;
        items = new EntryView[](count);

        for (uint256 i = 0; i < count; ) {
            uint32 entryId = uint32(offset + i + 1);
            Entry storage e = entries[waitlistId][entryId];
            items[i] = EntryView({
                entryId: entryId,
                wallet: e.wallet,
                status: e.status
            });
            unchecked {
                ++i;
            }
        }
    }

    function _requireWaitlist(
        uint256 waitlistId
    ) private view returns (Waitlist storage w) {
        if (waitlistId == 0 || waitlistId > waitlistCount) {
            revert WaitlistNotFound();
        }
        w = waitlists[waitlistId];
    }

    function _requireOrganiser(
        uint256 waitlistId
    ) private view returns (Waitlist storage w) {
        w = _requireWaitlist(waitlistId);
        if (msg.sender != w.organiser) revert NotOrganiser();
    }

    function _unlinkWaiting(
        Waitlist storage w,
        uint256 waitlistId,
        Entry storage e
    ) private {
        uint32 prev = e.prevWaiting;
        uint32 next = e.nextWaiting;

        if (prev == 0) {
            w.waitingHead = next;
        } else {
            entries[waitlistId][prev].nextWaiting = next;
        }

        if (next == 0) {
            w.waitingTail = prev;
        } else {
            entries[waitlistId][next].prevWaiting = prev;
        }

        e.prevWaiting = 0;
        e.nextWaiting = 0;
    }

    function _getPosition(
        uint256 waitlistId,
        address user
    ) private view returns (uint256 position, Status status, uint32 entryId) {
        Waitlist storage w = _requireWaitlist(waitlistId);
        entryId = latestEntryId[waitlistId][user];
        if (entryId == 0) {
            return (0, Status.None, 0);
        }

        status = entries[waitlistId][entryId].status;
        if (status != Status.Waiting) {
            return (0, status, entryId);
        }

        uint32 curr = w.waitingHead;
        uint256 pos = 1;
        while (curr != 0) {
            if (curr == entryId) {
                return (pos, status, entryId);
            }
            curr = entries[waitlistId][curr].nextWaiting;
            unchecked {
                ++pos;
            }
        }
    }

    function _toWaitlistView(
        uint256 id,
        Waitlist storage w
    ) private view returns (WaitlistView memory) {
        return
            WaitlistView({
                id: id,
                organiser: w.organiser,
                name: w.name,
                isOpen: w.isOpen,
                maxCapacity: w.maxCapacity,
                activeCount: w.activeCount,
                waitingCount: w.waitingCount,
                calledCount: w.calledCount,
                admittedCount: w.admittedCount,
                totalEntries: w.nextEntryId - 1
            });
    }
}
