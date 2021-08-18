// SPDX-License-Identifier: GPL-3.0-or-later

interface IFactory {
    function create(bytes calldata args) external returns (address instance);
}
