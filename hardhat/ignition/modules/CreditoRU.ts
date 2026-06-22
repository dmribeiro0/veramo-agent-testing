import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CreditoRUModule", (m) => {
    const unifespAddress = m.getParameter("unifespAddress");
    const ruAddress = m.getParameter("ruAddress");
    const creditoRU = m.contract("CreditoRU", [unifespAddress, ruAddress]);
    return { creditoRU };
});