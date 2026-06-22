// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CreditoRU {
    address public owner;
    mapping(address => bool) public autorizados;
    mapping(string => uint256) public saldoPorRA;
    mapping(bytes32 => bool) public consumoRegistrado;

    event CreditoAdicionado(string ra, uint256 quantidade, uint256 novoSaldo);
    event CreditoConsumido(string ra, bytes32 indexed consumoId, uint256 timestamp, uint256 saldoRestante);
    event AutorizadoAlterado(address conta, bool autorizado);

    modifier apenasAutorizado() {
        require(autorizados[msg.sender], "Conta nao autorizada");
        _;
    }

    constructor(address _unifesp, address _ru) {
        owner = msg.sender;
        autorizados[_unifesp] = true;
        autorizados[_ru] = true;
    }

    function definirAutorizado(address conta, bool autorizado) public {
        require(msg.sender == owner, "Apenas o owner pode alterar autorizados");
        autorizados[conta] = autorizado;
        emit AutorizadoAlterado(conta, autorizado);
    }

    function adicionarCreditos(string memory ra, uint256 quantidade) public apenasAutorizado {
        require(quantidade > 0, "Quantidade deve ser maior que zero");
        saldoPorRA[ra] += quantidade;
        emit CreditoAdicionado(ra, quantidade, saldoPorRA[ra]);
    }

    function consultarSaldo(string memory ra) public view returns (uint256) {
        return saldoPorRA[ra];
    }

    function consumirCredito(string memory ra) public apenasAutorizado returns (bytes32) {
        require(saldoPorRA[ra] > 0, "Saldo insuficiente");
        saldoPorRA[ra] -= 1;

        bytes32 consumoId = keccak256(abi.encodePacked(ra, block.timestamp, block.prevrandao));
        consumoRegistrado[consumoId] = true;

        emit CreditoConsumido(ra, consumoId, block.timestamp, saldoPorRA[ra]);
        return consumoId;
    }
}